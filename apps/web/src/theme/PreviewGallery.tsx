import { useEffect, useState } from "react";
import { Lock, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PreviewFrame } from "@ti/client";
import { useCatalogCache } from "../builder/catalog";
import { useSession } from "../context/session";
import { btn, inputClass } from "../components/ui";

/** Real components covering every token the studio edits, plus a Pro pipeline board. */
export const GALLERY_SLUGS = [
  "button",
  "input",
  "select",
  "checkbox",
  "switch",
  "tag",
  "badge",
  "card",
  "tabs",
  "data-table",
  "dialog",
  "pro-pipeline-board",
] as const;

const FRAME_HEIGHT: Record<string, number> = {
  "data-table": 320,
  "pro-pipeline-board": 420,
  dialog: 260,
  card: 260,
};

function Frame({
  slug,
  themeCss,
  onRemove,
}: {
  slug: string;
  themeCss: string;
  onRemove?: () => void;
}) {
  const entry = useCatalogCache((s) => s.previews[slug]);
  const ensure = useCatalogCache((s) => s.ensurePreview);
  useEffect(() => ensure(slug), [slug, ensure]);
  const height = FRAME_HEIGHT[slug] ?? 200;
  const wide = height >= 320;

  return (
    <figure
      className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2 xl:col-span-3" : ""}`}
    >
      <figcaption className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to={`/components/${slug}`} className="font-mono hover:text-foreground">
          {slug}
        </Link>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${slug} preview`}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </figcaption>
      {entry?.status === "error" ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-[#161616] p-4 text-center text-xs text-neutral-400"
          style={{ height }}
        >
          <Lock className="size-4" aria-hidden />
          <span>{entry.message}</span>
          {/premium|sign in/i.test(entry.message) ? (
            <Link to="/sign-in" className="underline hover:text-white">
              Sign in
            </Link>
          ) : null}
        </div>
      ) : (
        <PreviewFrame
          payload={entry?.status === "ok" ? entry.value : null}
          example={0}
          height={height}
          title={`${slug} preview`}
          themeCss={themeCss}
        />
      )}
    </figure>
  );
}

/** Live gallery of real components rendered in the sandbox with the theme, plus a slug picker. */
export function PreviewGallery({ themeCss }: { themeCss: string }) {
  const { components } = useSession();
  const [extra, setExtra] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const slugs = [...GALLERY_SLUGS, ...extra];

  const add = () => {
    const slug = pick.trim().toLowerCase();
    if (!slug || slugs.includes(slug)) return;
    setExtra((x) => [...x, slug]);
    setPick("");
  };

  return (
    <section aria-labelledby="preview-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="preview-h" className="mr-auto text-lg font-semibold text-foreground">
          Live preview
        </h2>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="preview-pick" className="sr-only">
            Preview any component by slug
          </label>
          <input
            id="preview-pick"
            list="preview-slugs"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            placeholder="Preview any component..."
            className={`${inputClass} w-48 sm:w-60`}
          />
          <datalist id="preview-slugs">
            {(components ?? [])
              .filter((c) => !slugs.includes(c.slug))
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </datalist>
          <button type="submit" className={btn.secondary} disabled={!pick.trim()}>
            <Plus className="size-4" aria-hidden />
            Add
          </button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slugs.map((slug) => (
          <Frame
            key={slug}
            slug={slug}
            themeCss={themeCss}
            onRemove={
              extra.includes(slug) ? () => setExtra((x) => x.filter((s) => s !== slug)) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
