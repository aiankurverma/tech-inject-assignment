# Third-party notices

Kitbase components may import only the libraries below (`ALLOWED_DEPENDENCIES` in
`packages/core/src/constants.ts`). Every one is MIT, Apache-2.0, BSD or ISC licensed. The
versions are the ones the preview sandbox and `@ti/ui` typecheck against. Each library remains
under its own licence and copyright; the full licence text ships inside its npm package.

Rule for contributors: use these libraries for the hard parts (table engine, virtualisation,
drag and drop, editors, graph layout, date maths, charts, forms...). If a component adapts
source code from an open-source project instead of importing it, add a row to "Adapted code"
below with the project, licence, URL and the file it went into.

## Core

| Package                         | Version | Licence | Source                                    |
| ------------------------------- | ------- | ------- | ----------------------------------------- |
| `react`                         | 19.3.0  | MIT     | https://github.com/react/react            |
| `lucide-react`                  | 0.469.0 | ISC     | https://github.com/lucide-icons/lucide    |
| `clsx`                          | 2.1.1   | MIT     | https://github.com/lukeed/clsx            |
| `tailwind-merge`                | 2.6.1   | MIT     | https://github.com/dcastil/tailwind-merge |
| `@radix-ui/react-checkbox`      | 1.3.11  | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-dialog`        | 1.1.23  | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-dropdown-menu` | 2.1.24  | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-popover`       | 1.1.23  | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-select`        | 2.3.7   | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-slider`        | 1.4.7   | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-slot`          | 1.3.3   | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-tabs`          | 1.1.21  | MIT     | https://github.com/radix-ui/primitives    |
| `@radix-ui/react-toggle-group`  | 1.1.19  | MIT     | https://github.com/radix-ui/primitives    |

## Pro libraries

| Package                       | Version | Licence      | Source                                                    |
| ----------------------------- | ------- | ------------ | --------------------------------------------------------- |
| `@ai-sdk/react`               | 4.0.125 | Apache-2.0   | https://github.com/vercel/ai                              |
| `@codemirror/autocomplete`    | 6.20.3  | MIT          | https://github.com/codemirror/autocomplete                |
| `@codemirror/lang-javascript` | 6.2.5   | MIT          | https://github.com/codemirror/lang-javascript             |
| `@codemirror/lang-json`       | 6.0.2   | MIT          | https://github.com/codemirror/lang-json                   |
| `@codemirror/lang-sql`        | 6.10.0  | MIT          | https://github.com/codemirror/lang-sql                    |
| `@codemirror/lint`            | 6.9.7   | MIT          | https://github.com/codemirror/lint                        |
| `@codemirror/state`           | 6.7.6   | MIT          | https://code.haverbeke.berlin/codemirror/state            |
| `@codemirror/view`            | 6.43.13 | MIT          | https://code.haverbeke.berlin/codemirror/view             |
| `@dagrejs/dagre`              | 3.1.1   | MIT          | https://github.com/dagrejs/dagre                          |
| `@date-fns/tz`                | 1.5.0   | MIT          | https://github.com/date-fns/date-fns                      |
| `@dnd-kit/core`               | 6.3.1   | MIT          | https://github.com/clauderic/dnd-kit                      |
| `@dnd-kit/sortable`           | 10.0.0  | MIT          | https://github.com/clauderic/dnd-kit                      |
| `@dnd-kit/utilities`          | 3.2.2   | MIT          | https://github.com/clauderic/dnd-kit                      |
| `@excalidraw/excalidraw`      | 0.18.1  | MIT          | https://github.com/excalidraw/excalidraw                  |
| `@floating-ui/react`          | 0.27.20 | MIT          | https://github.com/floating-ui/floating-ui                |
| `@formulajs/formulajs`        | 4.6.1   | MIT          | https://github.com/formulajs/formulajs                    |
| `@fullcalendar/core`          | 6.1.21  | MIT          | https://github.com/fullcalendar/fullcalendar              |
| `@fullcalendar/daygrid`       | 6.1.21  | MIT          | https://github.com/fullcalendar/fullcalendar              |
| `@fullcalendar/interaction`   | 6.1.21  | MIT          | https://github.com/fullcalendar/fullcalendar              |
| `@fullcalendar/list`          | 6.1.21  | MIT          | https://github.com/fullcalendar/fullcalendar              |
| `@fullcalendar/react`         | 6.1.21  | MIT          | https://github.com/fullcalendar/fullcalendar-react        |
| `@fullcalendar/timegrid`      | 6.1.21  | MIT          | https://github.com/fullcalendar/fullcalendar              |
| `@hookform/resolvers`         | 5.9.1   | MIT          | https://github.com/react-hook-form/resolvers              |
| `@nivo/sankey`                | 0.99.0  | MIT          | https://github.com/plouc/nivo                             |
| `@react-pdf/renderer`         | 4.9.0   | MIT          | https://github.com/diegomura/react-pdf                    |
| `@scalar/openapi-parser`      | 0.29.8  | MIT          | https://github.com/scalar/scalar                          |
| `@stripe/react-stripe-js`     | 6.12.0  | MIT          | https://github.com/stripe/react-stripe-js                 |
| `@stripe/stripe-js`           | 9.17.0  | MIT          | https://github.com/stripe/stripe-js                       |
| `@tanstack/react-query`       | 5.104.0 | MIT          | https://github.com/TanStack/query                         |
| `@tanstack/react-table`       | 9.2.4   | MIT          | https://github.com/TanStack/table                         |
| `@tanstack/react-virtual`     | 3.14.13 | MIT          | https://github.com/TanStack/virtual                       |
| `@tiptap/extension-list`      | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/extension-mention`   | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/extension-table`     | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/extensions`          | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/pm`                  | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/react`               | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/starter-kit`         | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@tiptap/suggestion`          | 3.31.3  | MIT          | https://github.com/ueberdosis/tiptap                      |
| `@turf/turf`                  | 7.4.0   | MIT          | https://github.com/Turfjs/turf                            |
| `@uiw/react-codemirror`       | 4.25.12 | MIT          | https://github.com/uiwjs/react-codemirror                 |
| `@uppy/core`                  | 6.1.0   | MIT          | https://github.com/transloadit/uppy                       |
| `@uppy/react`                 | 6.0.0   | MIT          | https://github.com/transloadit/uppy                       |
| `@xterm/addon-fit`            | 0.11.0  | MIT          | https://github.com/xtermjs/xterm.js                       |
| `@xterm/xterm`                | 6.0.0   | MIT          | https://github.com/xtermjs/xterm.js                       |
| `@xyflow/react`               | 12.12.0 | MIT          | https://github.com/xyflow/xyflow                          |
| `ai`                          | 7.0.122 | Apache-2.0   | https://github.com/vercel/ai                              |
| `ajv`                         | 8.20.0  | MIT          | https://github.com/ajv-validator/ajv                      |
| `anser`                       | 2.3.5   | MIT          | https://github.com/IonicaBizau/anser                      |
| `big.js`                      | 7.0.1   | MIT          | https://github.com/MikeMcl/big.js                         |
| `cmdk`                        | 1.1.1   | MIT          | https://github.com/pacocoursey/cmdk                       |
| `cron-parser`                 | 5.10.1  | MIT          | https://github.com/harrisiirak/cron-parser                |
| `cronstrue`                   | 3.27.0  | MIT          | https://github.com/bradymholt/cRonstrue                   |
| `date-fns`                    | 4.4.0   | MIT          | https://github.com/date-fns/date-fns                      |
| `deck.gl`                     | 9.4.0   | MIT          | https://github.com/visgl/deck.gl                          |
| `diff`                        | 9.0.0   | BSD-3-Clause | https://github.com/kpdecker/jsdiff                        |
| `dinero.js`                   | 2.0.2   | MIT          | https://github.com/dinerojs/dinero.js                     |
| `echarts`                     | 6.1.0   | Apache-2.0   | https://github.com/apache/echarts                         |
| `echarts-for-react`           | 3.0.6   | MIT          | https://github.com/hustcc/echarts-for-react               |
| `fuse.js`                     | 7.5.0   | Apache-2.0   | https://github.com/krisk/Fuse                             |
| `html-to-image`               | 1.11.13 | MIT          | https://github.com/bubkoo/html-to-image                   |
| `httpsnippet-lite`            | 3.0.5   | MIT          | https://github.com/P0lip/httpsnippet                      |
| `immer`                       | 11.1.18 | MIT          | https://github.com/immerjs/immer                          |
| `jsondiffpatch`               | 0.7.6   | MIT          | https://github.com/benjamine/jsondiffpatch                |
| `jsonpath-plus`               | 11.1.0  | MIT          | https://github.com/s3u/JSONPath                           |
| `jstat`                       | 1.9.6   | MIT          | http://github.com/jstat/jstat                             |
| `libphonenumber-js`           | 1.13.14 | MIT          | https://gitlab.com/catamphetamine/libphonenumber-js       |
| `maplibre-gl`                 | 6.11.2  | BSD-3-Clause | https://github.com/maplibre/maplibre-gl-js                |
| `motion`                      | 13.4.5  | MIT          | https://github.com/motiondivision/motion                  |
| `nuqs`                        | 2.10.1  | MIT          | https://github.com/47ng/nuqs                              |
| `papaparse`                   | 5.7.0   | MIT          | https://github.com/mholt/PapaParse                        |
| `pdf-lib`                     | 1.17.1  | MIT          | https://github.com/Hopding/pdf-lib                        |
| `pdfjs-dist`                  | 6.3.289 | Apache-2.0   | https://github.com/mozilla/pdf.js                         |
| `react-arborist`              | 3.16.0  | MIT          | https://github.com/jameskerr/react-arborist               |
| `react-day-picker`            | 10.0.1  | MIT          | https://github.com/gpbl/react-day-picker                  |
| `react-dropzone`              | 20.1.2  | MIT          | https://github.com/react-dropzone/react-dropzone          |
| `react-grid-layout`           | 2.2.4   | MIT          | https://github.com/git@github.com:STRML/react-grid-layout |
| `react-hook-form`             | 7.89.0  | MIT          | https://github.com/react-hook-form/react-hook-form        |
| `react-hotkeys-hook`          | 5.3.3   | MIT          | https://github.com/JohannesKlauss/react-keymap-hook       |
| `react-map-gl`                | 8.1.3   | MIT          | https://github.com/visgl/react-map-gl                     |
| `react-markdown`              | 10.1.0  | MIT          | https://github.com/remarkjs/react-markdown                |
| `react-pdf`                   | 11.0.0  | MIT          | https://github.com/wojtekmaj/react-pdf                    |
| `react-querybuilder`          | 8.24.3  | MIT          | https://github.com/react-querybuilder/react-querybuilder  |
| `react-resizable-panels`      | 4.14.1  | MIT          | https://github.com/bvaughn/react-resizable-panels         |
| `react-virtuoso`              | 4.18.15 | MIT          | https://github.com/petyosi/react-virtuoso                 |
| `react-zoom-pan-pinch`        | 4.2.0   | MIT          | https://github.com/BetterTyped/react-zoom-pan-pinch       |
| `read-excel-file`             | 9.3.10  | MIT          | https://gitlab.com/catamphetamine/read-excel-file         |
| `recharts`                    | 3.10.1  | MIT          | https://github.com/recharts/recharts                      |
| `remark-gfm`                  | 4.0.1   | MIT          | https://github.com/remarkjs/remark-gfm                    |
| `rrule`                       | 2.8.1   | BSD-3-Clause | https://github.com/jakubroztocil/rrule                    |
| `rrweb`                       | 2.1.6   | MIT          | https://github.com/ssh://git@github.com/rrweb-io/rrweb    |
| `rrweb-player`                | 2.1.6   | MIT          | https://github.com/rrweb-io/rrweb                         |
| `shiki`                       | 4.4.3   | MIT          | https://github.com/shikijs/shiki                          |
| `signature_pad`               | 5.1.4   | MIT          | https://github.com/szimek/signature_pad                   |
| `sql-formatter`               | 15.9.0  | MIT          | https://github.com/sql-formatter-org/sql-formatter        |
| `supercluster`                | 9.1.0   | ISC          | https://github.com/mapbox/supercluster                    |
| `y-websocket`                 | 3.1.0   | MIT          | https://github.com/yjs/y-websocket                        |
| `yjs`                         | 13.6.33 | MIT          | https://github.com/yjs/yjs                                |
| `zod`                         | 3.25.76 | MIT          | https://github.com/colinhacks/zod                         |
| `zustand`                     | 5.0.15  | MIT          | https://github.com/pmndrs/zustand                         |

Notes:

- `jstat` has no `license` field in package.json; its bundled LICENSE file is MIT.
- `@tiptap/pm` (MIT) is installed as the ProseMirror peer of the Tiptap packages but is not
  directly importable (it has no root entry point).
- `@react-email/components` was evaluated and left out: npm marks it deprecated, and its
  successor `react-email` is a CLI/dev-server package (esbuild, socket.io) not suited to the
  browser sandbox.
- Library stylesheets (`@xyflow/react`, `maplibre-gl`, `react-grid-layout`,
  `@excalidraw/excalidraw`, `rrweb-player`, `@xterm/xterm`, `react-day-picker`) are imported by path; the preview injects them as
  inline `<style>` so its CSP stays unchanged apart from `worker-src 'self' blob:`.

- `@xterm/xterm` is included because `@xterm/addon-fit` is only a plugin for it.
- `ajv` is pinned to v8 in the workspaces (v6 remains only as an ESLint transitive).

## Adapted code

- `packages/ui/src/components/crm/pro-web-terminal/xterm-styles.ts` contains a minified copy of
  `@xterm/xterm@6.0.0` `css/xterm.css` (MIT, Copyright (c) 2017-2019 The xterm.js authors), inlined so
  the Pro Web Terminal renders without the host bundler handling a CSS import.
