import * as React from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  FileText,
  LifeBuoy,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/crm/search-input";
import { Button } from "@/components/crm/button";

export interface HelpCategory {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  /** Short plain-text excerpt shown in results. */
  excerpt: string;
  /** Full plain-text body; blank lines become paragraphs, lines starting "## " become headings. */
  body: string;
  /** ISO date. */
  updatedAt: string;
  views?: number;
  tags?: string[];
}

export interface HelpCenterProps {
  categories: HelpCategory[];
  articles: HelpArticle[];
  title?: string;
  /** Controlled open article id (null = home). */
  articleId?: string | null;
  onArticleChange?: (id: string | null) => void;
  onVote?: (articleId: string, helpful: boolean) => void;
  /** Shown on empty search and at the end of articles. */
  onContactSupport?: () => void;
  loading?: boolean;
  className?: string;
}

/** Weighted relevance: title > tags > excerpt > body, all query terms must appear somewhere. */
export function scoreArticle(a: HelpArticle, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  let score = 0;
  const title = a.title.toLowerCase();
  const tags = (a.tags ?? []).join(" ").toLowerCase();
  const ex = a.excerpt.toLowerCase();
  const body = a.body.toLowerCase();
  for (const t of terms) {
    const s =
      (title.includes(t) ? 10 : 0) +
      (tags.includes(t) ? 6 : 0) +
      (ex.includes(t) ? 3 : 0) +
      (body.includes(t) ? 1 : 0);
    if (s === 0) return 0;
    score += s;
  }
  return score + Math.log10((a.views ?? 0) + 1);
}

function readMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).length / 200));
}

/** Self-serve knowledge base: ranked search, category browse, article reader with feedback and related. */
export function HelpCenter({
  categories,
  articles,
  title = "How can we help?",
  articleId,
  onArticleChange,
  onVote,
  onContactSupport,
  loading = false,
  className,
}: HelpCenterProps) {
  const [innerId, setInnerId] = React.useState<string | null>(null);
  const current = articleId === undefined ? innerId : articleId;
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [votes, setVotes] = React.useState<Record<string, boolean>>({});
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const open = (id: string | null) => {
    if (articleId === undefined) setInnerId(id);
    onArticleChange?.(id);
  };

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [current, category]);

  const article = current ? articles.find((a) => a.id === current) : undefined;
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const results = query.trim()
    ? articles
        .map((a) => ({ a, s: scoreArticle(a, query) }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .map((x) => x.a)
    : [];
  const popular = [...articles].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  const articleRow = (a: HelpArticle) => (
    <li key={a.id}>
      <button
        type="button"
        onClick={() => open(a.id)}
        className="flex w-full items-start gap-3 rounded-crm p-3 text-left outline-none hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring/60"
      >
        <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-crm-subtle" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium text-crm-fg">{a.title}</span>
          <span className="line-clamp-2 text-xs text-crm-soft">{a.excerpt}</span>
          <span className="crm-caption text-crm-subtle">
            {catName(a.categoryId)} · {readMinutes(a.body)} min read
          </span>
        </span>
        <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-crm-subtle" />
      </button>
    </li>
  );

  const contact = onContactSupport ? (
    <div className="flex flex-col items-start gap-2 rounded-crm border border-crm-border bg-crm-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2 text-sm text-crm-soft [&_svg]:size-4">
        <LifeBuoy aria-hidden /> Still stuck? Our team replies in under 2 hours on business days.
      </span>
      <Button variant="primary" onClick={onContactSupport}>
        Contact support
      </Button>
    </div>
  ) : null;

  if (loading)
    return (
      <div aria-busy="true" className={cn("flex flex-col gap-3", className)}>
        <div className="h-10 animate-pulse rounded-crm bg-crm-raised" />
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-crm bg-crm-raised" />
          ))}
        </div>
      </div>
    );

  if (article) {
    const related = articles
      .filter(
        (a) =>
          a.id !== article.id &&
          (a.categoryId === article.categoryId || a.tags?.some((t) => article.tags?.includes(t))),
      )
      .slice(0, 3);
    return (
      <article className={cn("flex flex-col gap-4 font-crm", className)}>
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-xs text-crm-subtle"
        >
          <button
            type="button"
            onClick={() => {
              open(null);
              setCategory(null);
            }}
            className="inline-flex items-center gap-1 hover:text-crm-fg [&_svg]:size-3"
          >
            <ArrowLeft aria-hidden /> Help center
          </button>
          <ChevronRight aria-hidden className="size-3" />
          <button
            type="button"
            onClick={() => {
              open(null);
              setCategory(article.categoryId);
            }}
            className="hover:text-crm-fg"
          >
            {catName(article.categoryId)}
          </button>
        </nav>
        <header className="flex flex-col gap-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-crm-fg outline-none"
          >
            {article.title}
          </h2>
          <p className="flex items-center gap-1 crm-caption text-crm-subtle [&_svg]:size-3">
            <Clock aria-hidden /> {readMinutes(article.body)} min read · Updated{" "}
            {new Date(article.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </header>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-crm-soft">
          {article.body.split(/\n\s*\n/).map((block, i) =>
            block.startsWith("## ") ? (
              <h3 key={i} className="mt-2 text-sm font-semibold text-crm-fg">
                {block.slice(3)}
              </h3>
            ) : (
              <p key={i}>{block}</p>
            ),
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-crm-border pt-4 text-sm text-crm-soft">
          {votes[article.id] === undefined ? (
            <>
              <span>Did this article answer your question?</span>
              {[true, false].map((yes) => (
                <Button
                  key={String(yes)}
                  size="sm"
                  onClick={() => {
                    setVotes((v) => ({ ...v, [article.id]: yes }));
                    onVote?.(article.id, yes);
                  }}
                >
                  {yes ? <ThumbsUp aria-hidden /> : <ThumbsDown aria-hidden />}
                  {yes ? "Yes" : "No"}
                </Button>
              ))}
            </>
          ) : (
            <span role="status">
              {votes[article.id]
                ? "Glad it helped."
                : "Sorry about that — support can take it from here."}
            </span>
          )}
        </div>
        {votes[article.id] === false ? contact : null}
        {related.length ? (
          <div className="flex flex-col gap-1">
            <h3 className="crm-eyebrow text-crm-soft">Related articles</h3>
            <ul>{related.map(articleRow)}</ul>
          </div>
        ) : null}
      </article>
    );
  }

  const inCategory = category ? articles.filter((a) => a.categoryId === category) : [];

  return (
    <section className={cn("flex flex-col gap-5 font-crm", className)} aria-label="Help center">
      <div className="flex flex-col gap-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-crm-fg outline-none"
        >
          {category ? catName(category) : title}
        </h2>
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search articles, e.g. “import contacts”"
          aria-label="Search help articles"
        />
      </div>

      {query.trim() ? (
        <div className="flex flex-col gap-2">
          <p className="crm-caption text-crm-subtle" aria-live="polite">
            {results.length} result{results.length === 1 ? "" : "s"} for “{query.trim()}”
          </p>
          {results.length ? (
            <ul>{results.map(articleRow)}</ul>
          ) : (
            (contact ?? <p className="text-sm text-crm-subtle">No articles found.</p>)
          )}
        </div>
      ) : category ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="inline-flex items-center gap-1 self-start text-xs text-crm-subtle hover:text-crm-fg [&_svg]:size-3"
          >
            <ArrowLeft aria-hidden /> All categories
          </button>
          {inCategory.length ? (
            <ul>{inCategory.map(articleRow)}</ul>
          ) : (
            <p className="text-sm text-crm-subtle">No articles in this category yet.</p>
          )}
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const n = articles.filter((a) => a.categoryId === c.id).length;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className="flex h-full w-full flex-col gap-1.5 rounded-crm border border-crm-border bg-crm-card p-4 text-left outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                  >
                    <span className="text-crm-primary [&_svg]:size-5">{c.icon}</span>
                    <span className="text-sm font-medium text-crm-fg">{c.name}</span>
                    {c.description ? (
                      <span className="text-xs text-crm-soft">{c.description}</span>
                    ) : null}
                    <span className="crm-caption text-crm-subtle">
                      {n} article{n === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {popular.length ? (
            <div className="flex flex-col gap-1">
              <h3 className="crm-eyebrow text-crm-soft">Popular articles</h3>
              <ul>{popular.map(articleRow)}</ul>
            </div>
          ) : null}
          {contact}
        </>
      )}
    </section>
  );
}
