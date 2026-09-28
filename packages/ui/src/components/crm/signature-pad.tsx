import * as React from "react";
import { Eraser, PenLine, Type, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
  p: number;
}
type Stroke = Point[];

export interface SignatureValue {
  mode: "draw" | "type";
  /** PNG data URL of the signature (transparent background). */
  dataUrl: string;
  /** Typed name (type mode) or the signer name supplied via props. */
  name?: string;
  signedAt: string;
}

export interface SignaturePadProps {
  /** Legal name of the signer, shown under the line and used to pre-fill type mode. */
  signerName?: string;
  onChange?: (value: SignatureValue | null) => void;
  /** Ink colour; defaults to the computed CRM foreground token (theme-aware). */
  color?: string;
  height?: number;
  disabled?: boolean;
  required?: boolean;
  /** Error text from the parent form (e.g. "Signature required"). */
  error?: string;
  /** Text above the line, e.g. the consent statement. */
  statement?: React.ReactNode;
  className?: string;
}

const MIN_W = 1.2;
const MAX_W = 3.4;
const TYPE_FONTS = [
  { id: "script", label: "Script", css: "'Brush Script MT', 'Segoe Script', cursive" },
  { id: "serif", label: "Formal", css: "'Georgia', 'Times New Roman', serif" },
];

/**
 * E-signature field for quotes, contracts and delivery sign-off. Draw mode captures pointer
 * strokes (mouse, pen pressure, touch) with velocity-based width and smoothing on a HiDPI
 * canvas; type mode renders the typed name in a signature font for keyboard and
 * screen-reader users. Supports undo, clear, disabled/required/error states and emits a
 * PNG data URL with a timestamp.
 */
export function SignaturePad({
  signerName,
  onChange,
  color,
  height = 180,
  disabled,
  required,
  error,
  statement,
  className,
}: SignaturePadProps) {
  const [mode, setMode] = React.useState<"draw" | "type">("draw");
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [typed, setTyped] = React.useState(signerName ?? "");
  const [font, setFont] = React.useState(TYPE_FONTS[0]?.id ?? "script");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const live = React.useRef<Stroke | null>(null);
  const last = React.useRef<{ t: number; w: number }>({ t: 0, w: MAX_W });
  const msgId = React.useId();
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const redraw = React.useCallback(
    (list: Stroke[]) => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const dpr = window.devicePixelRatio || 1;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const ink = color ?? getComputedStyle(c).color;
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      if (mode === "type") {
        const f = TYPE_FONTS.find((x) => x.id === font) ?? TYPE_FONTS[0];
        const w = c.width / dpr;
        let size = 48;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        do {
          ctx.font = `${size}px ${f?.css ?? "cursive"}`;
          size -= 2;
        } while (ctx.measureText(typed).width > w - 32 && size > 14);
        ctx.fillText(typed, w / 2, height / 2);
        return;
      }
      for (const s of list) {
        if (s.length === 1 && s[0]) {
          ctx.beginPath();
          ctx.arc(s[0].x, s[0].y, s[0].p / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        for (let i = 1; i < s.length; i++) {
          const a = s[i - 1];
          const b = s[i];
          const prev = s[i - 2] ?? a;
          if (!a || !b || !prev) continue;
          ctx.beginPath();
          ctx.lineWidth = b.p;
          // Quadratic through midpoints for smooth curves.
          ctx.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2);
          ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
          ctx.stroke();
        }
      }
    },
    [color, mode, typed, font, height],
  );

  // Size the canvas to its box at device pixel ratio.
  React.useLayoutEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      c.width = Math.round(w * dpr);
      c.height = Math.round(height * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${height}px`;
      redraw(strokes);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [height, redraw, strokes]);

  const empty = mode === "draw" ? strokes.length === 0 : !typed.trim();

  // Emit value whenever the signature changes.
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c || empty) {
      onChangeRef.current?.(null);
      return;
    }
    onChangeRef.current?.({
      mode,
      dataUrl: c.toDataURL("image/png"),
      name: mode === "type" ? typed.trim() : signerName,
      signedAt: new Date().toISOString(),
    });
  }, [strokes, typed, font, mode, empty, signerName]);

  const pointFrom = (canvas: HTMLCanvasElement, ev: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect();
    const now = ev.timeStamp;
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const prev = live.current?.[live.current.length - 1];
    let w = MAX_W;
    if (ev.pointerType === "pen" && ev.pressure > 0) {
      w = MIN_W + (MAX_W - MIN_W) * ev.pressure;
    } else if (prev) {
      const dt = Math.max(1, now - last.current.t);
      const v = Math.hypot(x - prev.x, y - prev.y) / dt; // px per ms
      const target = Math.max(MIN_W, MAX_W - v * 1.6);
      w = last.current.w * 0.7 + target * 0.3;
    }
    last.current = { t: now, w };
    return { x, y, p: w };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || mode !== "draw" || e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = { t: e.timeStamp, w: MAX_W };
    live.current = [pointFrom(e.currentTarget, e.nativeEvent)];
    redraw([...strokes, live.current]);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live.current) return;
    const native = e.nativeEvent;
    const events =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [native])
      live.current.push(pointFrom(e.currentTarget, ev));
    redraw([...strokes, live.current]);
  };
  const onUp = () => {
    const s = live.current;
    live.current = null;
    if (s?.length) setStrokes((prev) => [...prev, s]);
  };

  const clear = () => {
    setStrokes([]);
    if (mode === "type") setTyped("");
  };

  const tabCls = (on: boolean) =>
    cn(
      "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5",
      on ? "bg-crm-muted text-crm-fg shadow-crm-raised" : "text-crm-muted-fg hover:text-crm-fg",
    );

  return (
    <div
      className={cn("flex flex-col gap-2 font-crm", className)}
      role="group"
      aria-label="Signature"
      aria-describedby={error ? msgId : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex gap-1 rounded-full bg-crm-raised p-0.5"
          role="radiogroup"
          aria-label="Signature method"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "draw"}
            disabled={disabled}
            onClick={() => setMode("draw")}
            className={tabCls(mode === "draw")}
          >
            <PenLine /> Draw
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "type"}
            disabled={disabled}
            onClick={() => setMode("type")}
            className={tabCls(mode === "type")}
          >
            <Type /> Type
          </button>
        </div>
        <div className="flex gap-1">
          {mode === "draw" ? (
            <button
              type="button"
              onClick={() => setStrokes((s) => s.slice(0, -1))}
              disabled={disabled || !strokes.length}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2 text-xs text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-30 [&_svg]:size-3.5"
            >
              <Undo2 /> Undo
            </button>
          ) : null}
          <button
            type="button"
            onClick={clear}
            disabled={disabled || empty}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2 text-xs text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-30 [&_svg]:size-3.5"
          >
            <Eraser /> Clear
          </button>
        </div>
      </div>

      {mode === "type" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Type your full name</span>
            <input
              value={typed}
              disabled={disabled}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your full name"
              autoComplete="name"
              className="h-9 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-3 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40"
            />
          </label>
          <div className="flex gap-1" role="radiogroup" aria-label="Signature style">
            {TYPE_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={font === f.id}
                disabled={disabled}
                onClick={() => setFont(f.id)}
                className={cn(tabCls(font === f.id), "h-9 rounded-crm")}
                style={{ fontFamily: f.css }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        ref={wrapRef}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-crm-card",
          error ? "border-crm-danger" : "border-crm-border",
          disabled && "opacity-50",
        )}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            empty ? "Empty signature area" : `Signature${signerName ? ` of ${signerName}` : ""}`
          }
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={cn(
            "block touch-none text-crm-fg",
            mode === "draw" && !disabled ? "cursor-crosshair" : "cursor-default",
          )}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 flex items-end gap-2 border-b border-dashed border-crm-input">
          <span className="pb-1 text-lg leading-none text-crm-subtle">×</span>
        </div>
        {empty && mode === "draw" ? (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-crm-subtle">
            {disabled ? "Signing is disabled" : "Sign here with your mouse, pen or finger"}
          </p>
        ) : null}
        <div className="pointer-events-none absolute inset-x-6 bottom-2 flex justify-between text-[11px] text-crm-subtle">
          <span>
            {signerName ?? "Signer"}
            {required ? " *" : ""}
          </span>
          <span>
            {new Date().toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
      {statement ? <p className="text-xs leading-4 text-crm-subtle">{statement}</p> : null}
      {error ? (
        <p id={msgId} role="alert" className="text-xs text-crm-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
