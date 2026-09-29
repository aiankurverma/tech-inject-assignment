import type { ParseOptions, ParserMessage } from "@/components/crm/pro-csv-importer/types";

/*
 * In-house streaming RFC 4180 CSV parser.
 *
 * Why not a library: Papa Parse's worker mode bootstraps by re-loading its own script URL, which
 * does not exist once the code is bundled or runs in a sandboxed (opaque-origin) iframe. We need
 * the parser to run inside a Blob worker, so `parserMain` below is fully self-contained (no
 * imports, no closures) and is serialised with Function#toString into the worker source. Keep
 * it free of syntax a transpiler may down-level into helpers (?? and ?.), or the worker breaks.
 *
 * Handles: quoted fields, escaped quotes (""), CR / LF / CRLF line endings, newlines inside
 * quotes, fields and records split across chunk boundaries, UTF-8 multi-byte characters split
 * across chunks (streaming TextDecoder), a UTF-8 BOM, and delimiter auto-detection.
 */

interface ParserScope {
  postMessage: (msg: ParserMessage) => void;
}
interface ParseRequest {
  file: Blob;
  options: ParseOptions;
}

/** Self-contained: runs in a worker (scope = self) or on the main thread (scope = shim). */
export function parserMain(scope: ParserScope, request: ParseRequest): Promise<void> {
  const CANDIDATES = [",", ";", "\t", "|"];
  const file = request.file;
  const chunkSize = request.options.chunkSize || 1 << 20;
  const maxRows = request.options.maxRows || 500000;
  let delimiter = request.options.delimiter || "";

  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quotePending = false; // saw a quote inside a quoted field; next char decides
  let lastWasCR = false;
  let fieldStarted = false;
  let batch: string[][] = [];
  let count = 0;
  let truncated = false;

  function detect(sample: string): string {
    const lines = sample
      .split(/\r\n|\n|\r/)
      .slice(0, 20)
      .filter(Boolean);
    let best = ",";
    let bestScore = -1;
    for (const d of CANDIDATES) {
      const counts = lines.map((l) => {
        let n = 0;
        let q = false;
        for (let i = 0; i < l.length; i++) {
          const c = l[i];
          if (c === '"') q = !q;
          else if (c === d && !q) n++;
        }
        return n;
      });
      if (!counts.length || counts[0] === 0) continue;
      const first = counts[0] || 0;
      const consistent = counts.filter((n) => n === first).length;
      const score = consistent * 100 + first;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  function endField() {
    row.push(field);
    field = "";
    fieldStarted = false;
  }
  function endRow() {
    endField();
    // Skip fully blank lines.
    if (!(row.length === 1 && row[0] === "")) {
      if (count < maxRows) {
        batch.push(row);
        count++;
      } else truncated = true;
    }
    row = [];
  }

  function feed(text: string) {
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (lastWasCR) {
        lastWasCR = false;
        if (c === "\n") continue;
      }
      if (inQuotes) {
        if (quotePending) {
          quotePending = false;
          if (c === '"') {
            field += '"';
            continue;
          }
          inQuotes = false; // closing quote; fall through to handle c unquoted
        } else if (c === '"') {
          quotePending = true;
          continue;
        } else {
          field += c;
          continue;
        }
      }
      if (c === '"' && !fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
      } else if (c === delimiter) {
        endField();
      } else if (c === "\n" || c === "\r") {
        endRow();
        lastWasCR = c === "\r";
      } else {
        field += c;
        fieldStarted = true;
      }
    }
  }

  function flushBatch() {
    if (batch.length) {
      scope.postMessage({ type: "rows", rows: batch });
      batch = [];
    }
  }

  return (async () => {
    try {
      const decoder = new TextDecoder("utf-8");
      let offset = 0;
      let first = true;
      while (offset < file.size && !truncated) {
        const buf = await file.slice(offset, offset + chunkSize).arrayBuffer();
        offset += buf.byteLength;
        let text = decoder.decode(buf, { stream: offset < file.size });
        if (first) {
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
          if (!delimiter) delimiter = detect(text.slice(0, 64 * 1024));
          first = false;
        }
        feed(text);
        flushBatch();
        scope.postMessage({ type: "progress", bytes: offset, total: file.size, rows: count });
      }
      if (quotePending) {
        quotePending = false;
        inQuotes = false;
      }
      if (field !== "" || row.length > 0 || inQuotes) endRow();
      flushBatch();
      scope.postMessage({ type: "done", rows: count, delimiter: delimiter || ",", truncated });
    } catch (err) {
      scope.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Could not read the file",
      });
    }
  })();
}

export interface ParseHandle {
  cancel: () => void;
  /** True when parsing runs off the main thread. */
  inWorker: boolean;
}

/**
 * Parse a File in chunks, off the main thread when Blob workers are available (falls back to
 * an async main-thread loop that yields between chunks otherwise).
 */
export function parseCsvFile(
  file: Blob,
  options: ParseOptions,
  onMessage: (msg: ParserMessage) => void,
): ParseHandle {
  let cancelled = false;
  const emit = (msg: ParserMessage) => {
    if (!cancelled) onMessage(msg);
  };
  try {
    const src = `const parserMain = ${parserMain.toString()};\nself.onmessage = (e) => parserMain(self, e.data);`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<ParserMessage>) => {
      emit(e.data);
      if (e.data.type === "done" || e.data.type === "error") {
        worker.terminate();
        URL.revokeObjectURL(url);
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      emit({ type: "error", message: e.message || "Parser worker failed" });
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    worker.postMessage({ file, options });
    return {
      inWorker: true,
      cancel: () => {
        cancelled = true;
        worker.terminate();
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    // Worker blocked (CSP / old runtime): same parser on the main thread, yielding per chunk.
    void parserMain(
      {
        postMessage: (msg) => {
          setTimeout(() => emit(msg), 0);
        },
      },
      { file, options },
    );
    return { inWorker: false, cancel: () => (cancelled = true) };
  }
}
