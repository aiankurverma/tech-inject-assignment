import { transform } from "sucrase";
import { MODULES } from "./modules";

export interface PreviewFile {
  path: string;
  content: string;
}

type Exports = Record<string, unknown>;

const stripExt = (p: string) => p.replace(/\.(tsx|ts|css)$/, "");

/** Compiles TSX files with sucrase and links them with a require() limited to allowed modules. */
export function loadModule(files: PreviewFile[], entryCode: string): Exports {
  const sources = new Map<string, string>(files.map((f) => [stripExt(f.path), f.content]));
  const cache = new Map<string, Exports>();

  const run = (id: string, code: string): Exports => {
    const cached = cache.get(id);
    if (cached) return cached;
    const compiled = transform(code, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "automatic",
      production: true,
      filePath: `${id}.tsx`,
    }).code;
    const module = { exports: {} as Exports };
    cache.set(id, module.exports);
    const require = (spec: string): unknown => {
      if (spec in MODULES) return MODULES[spec];
      if (spec.startsWith("@/")) {
        const target = stripExt(spec.slice(2));
        const src = sources.get(target);
        if (src === undefined) throw new Error(`Cannot find module "${spec}" in bundle`);
        if (target.startsWith("styles/")) return {};
        return run(target, src);
      }
      throw new Error(`Import "${spec}" is not allowed in previews`);
    };
    // `React` is also in scope so code using React.* without importing it still previews.
    new Function("require", "module", "exports", "React", compiled)(
      require,
      module,
      module.exports,
      MODULES.react,
    );
    cache.set(id, module.exports);
    return module.exports;
  };

  return run("__example__", entryCode);
}
