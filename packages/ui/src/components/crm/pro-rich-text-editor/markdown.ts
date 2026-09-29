import type { JSONContent } from "@tiptap/react";

/*
 * JSON -> GitHub-flavoured Markdown. Written in-house: Tiptap's markdown package (@tiptap/markdown)
 * is not on the approved list, and the approved markdown libraries (react-markdown, remark-gfm)
 * only parse markdown into React, they do not serialise a ProseMirror document.
 */

type Mark = NonNullable<JSONContent["marks"]>[number];

function escapeText(text: string) {
  return text.replace(/([\\`*_[\]<>|])/g, "\\$1");
}

function wrapMarks(text: string, marks: Mark[] | undefined) {
  if (!marks?.length) return escapeText(text);
  const code = marks.some((m) => m.type === "code");
  let out = code ? `\`${text.replace(/`/g, "\\`")}\`` : escapeText(text);
  for (const m of marks) {
    if (m.type === "bold") out = `**${out}**`;
    else if (m.type === "italic") out = `_${out}_`;
    else if (m.type === "strike") out = `~~${out}~~`;
  }
  const link = marks.find((m) => m.type === "link");
  if (link?.attrs?.href) out = `[${out}](${String(link.attrs.href)})`;
  return out;
}

function inline(nodes: JSONContent[] | undefined): string {
  if (!nodes) return "";
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += wrapMarks(n.text ?? "", n.marks);
    else if (n.type === "hardBreak") out += "  \n";
    else if (n.type === "mention") {
      const char = (n.attrs?.mentionSuggestionChar as string) ?? "@";
      out += `${char}${String(n.attrs?.label ?? n.attrs?.id ?? "")}`;
    } else if (n.content) out += inline(n.content);
  }
  return out;
}

function indent(text: string, pad: string) {
  return text
    .split("\n")
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join("\n");
}

function tableToMarkdown(node: JSONContent): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((p) => inline(p.content))
        .join(" ")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " "),
    ),
  );
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(cols - r.length).fill("")];
  const line = (r: string[]) => `| ${pad(r).join(" | ")} |`;
  return [line(rows[0]!), line(Array(cols).fill("---")), ...rows.slice(1).map(line)].join("\n");
}

function block(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content);
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content)}`;
    case "blockquote":
      return blocks(node.content)
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string | null) ?? "";
      const text = (node.content ?? []).map((t) => t.text ?? "").join("");
      const fence = text.includes("```") ? "````" : "```";
      return `${fence}${lang}\n${text}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    case "image":
      return `![${String(node.attrs?.alt ?? "")}](${String(node.attrs?.src ?? "")})`;
    case "bulletList":
      return (node.content ?? []).map((li) => listItem(li, "- ")).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? []).map((li, i) => listItem(li, `${start + i}. `)).join("\n");
    }
    case "taskList":
      return (node.content ?? [])
        .map((li) => listItem(li, li.attrs?.checked ? "- [x] " : "- [ ] "))
        .join("\n");
    case "table":
      return tableToMarkdown(node);
    default:
      return node.content ? blocks(node.content) : inline([node]);
  }
}

function listItem(li: JSONContent, marker: string) {
  const body = (li.content ?? []).map((c) => block(c)).join("\n");
  return marker + indent(body, " ".repeat(marker.length));
}

function blocks(nodes: JSONContent[] | undefined): string {
  return (nodes ?? []).map((n) => block(n)).join("\n\n");
}

/** Serialise a Tiptap JSON document to GitHub-flavoured Markdown. */
export function toMarkdown(doc: JSONContent): string {
  return blocks(doc.content).trim() + "\n";
}
