import "@tailwindcss/browser";
import { Component, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { loadModule, type PreviewFile } from "./runtime";

/**
 * Receives { type: "render", payload, example } by postMessage from the catalogue/admin,
 * compiles the bundle and renders one example. Never fetches anything itself.
 */
const allowed = (
  import.meta.env.VITE_PARENT_ORIGINS ??
  "http://localhost:5183,http://localhost:5184,http://localhost:4000"
)
  .split(",")
  .map((o: string) => o.trim());

interface RenderMessage {
  type: "render";
  example: number;
  payload: { themeCss: string; files: PreviewFile[]; examples: { title: string; code: string }[] };
}

const isRender = (d: unknown): d is RenderMessage => {
  if (typeof d !== "object" || d === null) return false;
  const m = d as Partial<RenderMessage>;
  return (
    m.type === "render" &&
    typeof m.example === "number" &&
    typeof m.payload?.themeCss === "string" &&
    Array.isArray(m.payload.files) &&
    Array.isArray(m.payload.examples)
  );
};

class Boundary extends Component<
  { children: ReactNode; onError: (e: Error) => void },
  { error: Error | null }
> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  override render() {
    return this.state.error ? (
      <ErrorView message={this.state.error.message} />
    ) : (
      this.props.children
    );
  }
}

const ErrorView = ({ message }: { message: string }) => (
  <div
    role="alert"
    style={{ color: "#f97373", fontFamily: "monospace", fontSize: 13, padding: 16 }}
  >
    Preview error: {message}
  </div>
);

const root = createRoot(document.getElementById("root")!);
let parentOrigin = "";

function post(msg: Record<string, unknown>) {
  if (parentOrigin) window.parent.postMessage(msg, parentOrigin);
}

function setTheme(css: string) {
  let el = document.getElementById("crm-theme");
  if (!el) {
    el = document.createElement("style");
    el.id = "crm-theme";
    el.setAttribute("type", "text/tailwindcss");
    document.head.appendChild(el);
  }
  // Font is loaded by index.html; drop remote @import so the CSP stays strict.
  el.textContent = `@import "tailwindcss";\n${css.replace(/@import url\([^)]*\);?/g, "")}\nbody{background:var(--color-crm-bg);color:var(--color-crm-fg);font-family:var(--font-crm);margin:0}`;
}

window.addEventListener("message", (event) => {
  if (!allowed.includes(event.origin) || !isRender(event.data)) return;
  parentOrigin = event.origin;
  const { payload, example } = event.data;
  setTheme(payload.themeCss);
  const ex = payload.examples[example] ?? payload.examples[0];
  try {
    if (!ex) throw new Error("No example to render");
    const mod = loadModule(payload.files, ex.code);
    const Example = mod.default as ComponentType | undefined;
    if (typeof Example !== "function")
      throw new Error("Example must have a default export component");
    root.render(
      <Boundary onError={(e) => post({ type: "error", message: e.message })}>
        <div className="flex min-h-screen items-center justify-center p-6">
          <Example />
        </div>
      </Boundary>,
    );
    post({ type: "rendered" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    root.render(<ErrorView message={message} />);
    post({ type: "error", message });
  }
});

window.parent.postMessage({ type: "ready" }, "*");
