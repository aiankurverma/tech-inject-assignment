import { PromptToScreen } from "@ti/client";
import { Card, PageHeader } from "../components/ui";

/** Admin "prompt to screen": every published component (free and premium) is available. */
export function Screens() {
  return (
    <>
      <PageHeader
        title="Prompt to screen"
        description="Describe a page and the AI composes it from published components only. Preview it, edit the tree JSON, then export Page.tsx with its install commands."
      />
      <Card className="p-4 sm:p-5">
        <PromptToScreen
          endpoint="/api/admin/screens"
          componentHref={(s) => `/admin/components/${s}`}
        />
      </Card>
    </>
  );
}
