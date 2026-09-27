import { useEffect, useRef, useState } from "react";
import type { PreviewPayload } from "./api";

const PREVIEW_ORIGIN = import.meta.env.VITE_PREVIEW_ORIGIN ?? "http://localhost:5185";

/** Dark placeholder shown until the first render lands; matches the frame background. */
function PreviewSkeleton({ slow }: { slow: boolean }) {
  return (
    <div
      role="status"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-[inherit] bg-[#161616] p-6"
    >
      <div aria-hidden className="w-full max-w-xs animate-pulse space-y-3">
        <div className="h-3 w-1/3 rounded-full bg-white/10" />
        <div className="h-9 rounded-lg bg-white/[0.07]" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-full bg-white/10" />
          <div className="h-7 w-16 rounded-full bg-white/[0.07]" />
          <div className="h-7 w-12 rounded-full bg-white/[0.05]" />
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        {slow ? "Compiling preview, this can take a few seconds..." : "Loading preview..."}
      </p>
    </div>
  );
}

/**
 * Renders a bundle inside a sandboxed iframe on a separate origin.
 * sandbox="allow-scripts" without allow-same-origin gives the frame an opaque origin:
 * no cookies, no storage, no access to this page. Code is sent by postMessage.
 * `scale` zooms the rendered page (e.g. 1.25 for small primitives); `frameClassName`
 * replaces the iframe's border/radius classes when the frame sits inside a card.
 */
export function PreviewFrame({
  payload,
  example,
  height = 360,
  title,
  scale = 1,
  frameClassName = "rounded-lg border border-neutral-200",
}: {
  payload: PreviewPayload | null;
  example: number;
  height?: number;
  title: string;
  scale?: number;
  frameClassName?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const data = e.data as { type?: string; message?: string };
      if (data.type === "ready") setReady(true);
      if (data.type === "rendered") {
        setRendered(true);
        setError(null);
      }
      if (data.type === "error") {
        setRendered(true);
        setError(data.message ?? "Preview failed");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    // Opaque-origin frames can only be addressed with "*"; the payload is what the user may already see.
    if (ready && payload)
      ref.current?.contentWindow?.postMessage({ type: "render", payload, example }, "*");
  }, [ready, payload, example]);

  // A new component (not a new variant) shows the skeleton again until it renders.
  useEffect(() => {
    if (!payload) setRendered(false);
  }, [payload]);

  const loading = !ready || !payload || !rendered;
  useEffect(() => {
    if (!loading) return;
    setSlow(false);
    const t = window.setTimeout(() => setSlow(true), 2500);
    return () => window.clearTimeout(t);
  }, [loading]);

  return (
    <div>
      <div className={`relative overflow-hidden bg-[#161616] ${frameClassName}`} style={{ height }}>
        {loading ? <PreviewSkeleton slow={slow} /> : null}
        <iframe
          ref={ref}
          title={title}
          src={`${PREVIEW_ORIGIN}/`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="block origin-top-left border-0 bg-[#161616]"
          style={{
            width: `${100 / scale}%`,
            height: height / scale,
            transform: scale === 1 ? undefined : `scale(${scale})`,
          }}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 [.dark_&]:border-red-900 [.dark_&]:bg-red-950/40 [.dark_&]:text-red-300"
        >
          Preview error: {error}
        </p>
      ) : null}
    </div>
  );
}
