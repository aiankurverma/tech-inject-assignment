import { useMemo } from "react";
import { Layout } from "../components/Layout";
import { Breadcrumbs, PageHeader } from "../components/ui";
import { ComponentCard, ComponentsState } from "./Home";
import { useSession } from "../context/session";
import type { ListItem } from "../context/session";

/** Newest-first list of published components, grouped by the day they went live. */
export function Changelog() {
  const { components } = useSession();
  const groups = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const c of [...(components ?? [])].sort((a, b) =>
      (b.publishedAt ?? b.createdAt ?? "").localeCompare(a.publishedAt ?? a.createdAt ?? ""),
    )) {
      const key = (c.publishedAt ?? c.createdAt ?? "").slice(0, 10) || "Undated";
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [components]);

  return (
    <Layout>
      <Breadcrumbs items={[{ label: "Changelog" }]} />
      <PageHeader title="Changelog">
        New and updated CRM React components. Every entry links to a page with a live preview,
        props, source and an install command.
      </PageHeader>
      <ComponentsState>
        {() => (
          <div className="space-y-12">
            {groups.map(([date, items]) => (
              <section key={date}>
                <h2 className="mb-4 flex items-baseline gap-3 text-lg font-semibold">
                  {date}
                  <span className="text-xs font-normal text-muted-foreground">
                    {items.length} component{items.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((c, i) => (
                    <li key={c.slug}>
                      <ComponentCard c={c} eager={i < 3} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </ComponentsState>
    </Layout>
  );
}
