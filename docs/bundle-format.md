# Component bundle format (admin upload)

Admins upload one JSON file per component in **Admin -> New component -> Upload JSON bundle** (or paste it).
The server validates it (`packages/core/src/bundle.ts`), stores it as a **draft**, and only **Publish** makes it public.
Publishing copies the draft into an immutable `published` snapshot. Preview, Copy code, the installer and the agent
prompt all read that same snapshot, so they always show the same version.

```jsonc
{
  "name": "Deal Card", // 2-60 chars
  "slug": "deal-card", // unique, lowercase-dashes, cannot change later
  "description": "One-line summary.", // 10-400 chars
  "category": "Data display", // sidebar group
  "version": "1.0.0", // MAJOR.MINOR.PATCH
  "access": "free", // "free" | "premium"
  "dependencies": ["lucide-react"], // npm packages, must be in the allow-list below
  "files": [
    // 1-20 files, paths relative to the consumer's src/
    { "path": "components/crm/deal-card.tsx", "content": "export function DealCard() { ... }" },
  ],
  "examples": [
    // 1-12; each is a TSX module with a default export
    {
      "title": "Default",
      "code": "import { DealCard } from \"@/components/crm/deal-card\";\nexport default function Example() { return <DealCard />; }",
    },
  ],
  "props": [
    // optional docs table
    {
      "name": "title",
      "type": "string",
      "required": true,
      "default": "\"\"",
      "description": "Card title",
    },
  ],
  "usage": "When to use it.", // optional, plain text
  "thumbnail": "data:image/png;base64,...", // optional static image for locked previews (PNG/SVG/WebP, <= 300 KB)
}
```

## Rules

| Rule                                                                                                                                                    | Why                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Paths start with `components/`, `lib/`, `hooks/` or `styles/`, use kebab-case names and end in `.tsx`, `.ts` or `.css`; no `..`, `\`, or absolute paths | The installer can only write inside the consumer's `src/`                                                                     |
| `styles/crm-theme.css` and `lib/utils.ts` are reserved                                                                                                  | They are added automatically from the theme                                                                                   |
| Code that uses `React.*` (e.g. `React.useState`) must import React: `import * as React from "react"`                                                    | The preview puts `React` in scope, so without this rule a bundle could preview fine but fail to compile in a consumer project |
| Imports: `react`, `react/jsx-runtime`, allow-listed packages, or `@/...` files that exist in the bundle                                                 | Preview runs only known code; installs stay predictable                                                                       |
| Every imported package must be listed in `dependencies`                                                                                                 | Copy/install instructions stay complete                                                                                       |
| Relative imports (`./x`) are rejected                                                                                                                   | Use `@/components/...` so files work in any project                                                                           |
| Max 100 KB per file, 500 KB per bundle, unknown fields rejected                                                                                         | Keeps storage and previews safe                                                                                               |

Allowed packages: `lucide-react`, `clsx`, `tailwind-merge`, `@radix-ui/react-checkbox`, `@radix-ui/react-dialog`,
`@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-slider`,
`@radix-ui/react-slot`, `@radix-ui/react-tabs` (see `ALLOWED_DEPENDENCIES` in `packages/core/src/constants.ts`).

Styling: use Tailwind classes and the CRM tokens from the theme (`bg-crm-bg`, `text-crm-fg`, `shadow-crm-raised`,
`border-tag-blue-border`, `font-crm`, `crm-caption`...). See `docs/reference/tokens.md`.

Uploaded code is **never executed on the server or in the admin page**. It only runs inside the sandboxed preview app
on a separate origin (see README, "Preview isolation").
