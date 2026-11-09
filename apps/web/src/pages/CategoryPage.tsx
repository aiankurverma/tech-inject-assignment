import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader, Breadcrumbs, btn } from "../components/ui";
import { ComponentCard, ComponentsState } from "./Home";
import { useSession } from "../context/session";
import type { ListItem } from "../context/session";

const slugify = (category: string) =>
  category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A category landing page: every component in one category, with links to the others. */
export function CategoryPage() {
  const { category = "" } = useParams();
  const { components } = useSession();
  const categories = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const c of components ?? []) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [components]);
  const display =
    categories.find(([name]) => slugify(name) === category)?.[0] ?? category.replace(/-/g, " ");

  return (
    <Layout>
      <Breadcrumbs items={[{ label: "Components", to: "/components" }, { label: display }]} />
      <PageHeader title={`${display} components`}>
        {display} components for CRM and internal tools. Each one ships as TypeScript source you can
        copy or install with the CLI.
      </PageHeader>
      <ComponentsState>
        {(items) => {
          const shown = items.filter((c) => slugify(c.category) === category);
          if (!shown.length)
            return (
              <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
                No components in this category yet.{" "}
                <Link to="/components" className="font-medium text-foreground hover:underline">
                  Browse all components
                </Link>
                .
              </div>
            );
          return (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                {shown.length} component{shown.length === 1 ? "" : "s"}
              </p>
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((c, i) => (
                  <li key={c.slug}>
                    <ComponentCard c={c} eager={i < 6} />
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </ComponentsState>
      <nav aria-label="Other categories" className="mt-12 border-t border-border pt-6">
        <p className="mb-3 text-sm font-medium">Other categories</p>
        <div className="flex flex-wrap gap-2">
          {categories
            .filter(([name]) => slugify(name) !== category)
            .map(([name, list]) => (
              <Link
                key={name}
                to={`/components/category/${slugify(name)}`}
                className={`${btn.secondary} h-8 px-3 text-sm`}
              >
                {name} <span className="text-muted-foreground">{list.length}</span>
              </Link>
            ))}
        </div>
      </nav>
    </Layout>
  );
}
