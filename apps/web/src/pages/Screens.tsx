import { PromptToScreen } from "@ti/client";
import { Layout } from "../components/Layout";
import { Breadcrumbs, PageHeader } from "../components/ui";
import { useSession } from "../context/session";

const toc = [
  { id: "prompt", label: "Describe" },
  { id: "how", label: "How it works" },
];

/** Public "prompt to screen": compose a page from the components this visitor may use. */
export function Screens() {
  const { me } = useSession();
  return (
    <Layout toc={toc}>
      <div className="max-w-4xl">
        <Breadcrumbs items={[{ label: "Docs", to: "/docs/get-started" }, { label: "Screens" }]} />
        <div className="mt-4">
          <PageHeader title="Prompt to screen">
            Describe a page and get a layout built only from Kitbase components, with a live
            preview, the JSON tree, a ready Page.tsx and the install commands.
            {me?.plan === "premium"
              ? " Your premium plan includes the Pro components."
              : " Sign in with a premium account to compose with Pro components too."}
          </PageHeader>
        </div>
        <section id="prompt" className="scroll-mt-20">
          <PromptToScreen endpoint="/api/screens" componentHref={(s) => `/components/${s}`} />
        </section>
        <section id="how" className="mt-16 scroll-mt-20 space-y-3 text-sm text-muted-foreground">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">How it works</h2>
          <p>
            The AI only sees the catalogue (slug, description, exports and props) and answers with a
            tree of <code>{"{ id, type, props, children }"}</code> nodes. The server rejects unknown
            components, unknown exports, non-JSON props and trees that are too deep or too large,
            then generates the page code itself. Nothing the AI writes runs unchecked.
          </p>
          <p>
            The preview runs in the same sandboxed frame as component demos. Edit the tree JSON and
            re-render to fine-tune the result before copying it.
          </p>
        </section>
      </div>
    </Layout>
  );
}
