import { CodeBlock } from "@ti/client";
import { CSS_SETUP } from "@ti/core";
import { Layout } from "../components/Layout";
import { Breadcrumbs } from "../components/ui";

const origin = typeof window !== "undefined" ? window.location.origin : "";

const toc = [
  { id: "requirements", label: "Requirements" },
  { id: "setup", label: "Project setup" },
  { id: "install", label: "Add a component" },
  { id: "premium", label: "Premium components" },
  { id: "agent", label: "Using an AI agent" },
];

export function GetStarted() {
  return (
    <Layout toc={toc}>
      <article className="doc-prose max-w-3xl space-y-5 [&_h2]:scroll-mt-20 [&_h2]:pt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2+*]:mt-3!">
        <Breadcrumbs
          items={[{ label: "Docs", to: "/docs/get-started" }, { label: "Get started" }]}
        />
        <h1 className="mt-4! text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Get started
        </h1>
        <p className="mt-3! max-w-2xl text-lg leading-8 text-muted-foreground">
          Components are plain React + TypeScript files styled with Tailwind CSS v4 and the CRM
          theme. They are copied into your project, so you own and can change the code.
        </p>

        <h2 id="requirements">Requirements</h2>
        <ul className="list-disc space-y-1.5 pl-6 marker:text-muted-foreground/70">
          <li>Node.js 18.17 or newer</li>
          <li>React 18 or 19 with TypeScript</li>
          <li>Tailwind CSS v4</li>
          <li>
            An <code>@/</code> import alias that points to your <code>src</code> folder
          </li>
        </ul>

        <h2 id="setup">Project setup (Vite)</h2>
        <p>Create a new app, or skip to step 2 in an existing one.</p>
        <CodeBlock
          label="terminal"
          code={`npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install tailwindcss @tailwindcss/vite
npm install -D @types/node`}
        />
        <p>
          Add Tailwind and the alias to <code>vite.config.ts</code>:
        </p>
        <CodeBlock
          label="vite.config.ts"
          code={`import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});`}
        />
        <p>
          Add the alias for TypeScript in <code>tsconfig.app.json</code> (under compilerOptions):
        </p>
        <CodeBlock
          label="tsconfig.app.json"
          code={`"baseUrl": ".",\n"paths": { "@/*": ["./src/*"] }`}
        />
        <p>
          Replace <code>src/index.css</code> with:
        </p>
        <CodeBlock label="src/index.css" code={CSS_SETUP} />
        <p>
          The theme file is added by the first component you install. Use a dark page background,
          for example <code>&lt;body className="bg-crm-bg text-crm-fg font-crm"&gt;</code>.
        </p>

        <h2 id="install">Add a component</h2>
        <p>
          Run this from your project root. It writes only inside <code>src/</code> and never
          overwrites a changed file.
        </p>
        <CodeBlock label="terminal" code={`npx --yes ${origin}/cli/kitbase.tgz add button`} />
        <p>
          Then install the dependencies it prints. Options: <code>--src app</code> (other source
          folder), <code>--dry-run</code>, <code>--overwrite</code> (replace changed files).
        </p>

        <h2 id="premium">Premium components</h2>
        <p>
          Sign in with a premium account, open <strong>Account</strong> and create an access token.
          Keep it in your shell environment, never in code or prompts:
        </p>
        <CodeBlock
          label="terminal"
          code={`# macOS / Linux
export KITBASE_TOKEN=ti_xxxxxxxx
# Windows PowerShell
$env:KITBASE_TOKEN="ti_xxxxxxxx"

npx --yes ${origin}/cli/kitbase.tgz add <premium-component>`}
        />
        <p>
          Access is checked on every request. If your premium access is removed, new installs fail
          even with a valid token. Code you already copied or installed stays in your project.
        </p>

        <h2 id="agent">Using an AI agent</h2>
        <p>
          On any component page, click <strong>Copy prompt</strong> and paste it into your agent
          (Claude Code, Cursor...). The prompt explains how to install, keep the theme and verify
          the result. For premium components the agent uses <code>KITBASE_TOKEN</code> from your
          environment; the token is never part of the prompt.
        </p>
      </article>
    </Layout>
  );
}
