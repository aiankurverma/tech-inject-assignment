// Simulates a user pasting the "Copy code" text: fetch it, split on the file markers, write files.
const [slug] = process.argv.slice(2);
const text = await (await fetch(`http://localhost:4000/api/components/${slug}/copy`)).text();
const fs = await import("node:fs");
const parts = text.split(/^\/\/ ===== (.+?) =====$/m);
for (let i = 1; i < parts.length; i += 2) {
  const name = parts[i];
  if (!name.startsWith("src/")) continue;
  fs.mkdirSync(name.slice(0, name.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(name, parts[i + 1].replace(/^\n/, ""));
  console.log("pasted", name);
}
fs.writeFileSync(
  "src/App.tsx",
  parts[parts.length - 1]
    .replace(/^\n/, "")
    .replace("export default function", "export function App() { return <Example />; }\nfunction"),
);
