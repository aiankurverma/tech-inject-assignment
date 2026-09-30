import { describe, expect, it } from "vitest";
import { resolveComponentMeta } from "./codegen";
import { defaultProps, parseLiteral, placeholderFor, propsFromExample } from "./defaults";
import { registryDetail as registry, registrySlugs } from "./registry-fixture";

const seed = (slug: string) => {
  const d = registry(slug);
  return defaultProps(d, resolveComponentMeta(d).exportName);
};

describe("parseLiteral", () => {
  it("keeps JSON-safe values and drops functions and JSX", () => {
    expect(
      parseLiteral(`[
        { id: "a", title: 'One', n: 2, ok: true, run: () => go(), el: <b>x, y</b>, // note
          content: (<p className="x">Hi, there</p>) },
        { id: "b", nested: { list: [1, 2,], v: null }, ...rest },
        () => 1,
      ]`),
    ).toEqual([
      { id: "a", title: "One", n: 2, ok: true },
      { id: "b", nested: { list: [1, 2], v: null } },
    ]);
  });

  it("returns undefined for non-literals", () => {
    expect(parseLiteral("items.map((i) => i)")).toBeUndefined();
    expect(parseLiteral("`x ${y}`")).toBeUndefined();
    expect(parseLiteral('"a" + b')).toBeUndefined();
  });
});

describe("propsFromExample", () => {
  it("reads literal attributes, const references and text children", () => {
    const code = `
      const rows: Row[] = [{ id: 1, name: "Acme" }];
      export default function Example() {
        const [v, setV] = React.useState(1);
        return <Thing title="Deals" count={3} rows={rows} value={v} onChange={setV} open className="x">Hello  there</Thing>;
      }`;
    expect(propsFromExample(code, "Thing")).toEqual({
      title: "Deals",
      count: 3,
      rows: [{ id: 1, name: "Acme" }],
      open: true,
      children: "Hello there",
    });
  });
});

describe("placeholderFor", () => {
  const p = (type: string, name = "x") => ({ name, type, required: true, description: "" });
  it("maps types to safe defaults", () => {
    expect(placeholderFor(p("Step[]"), "C")).toEqual([]);
    expect(placeholderFor(p("Array<Row>"), "C")).toEqual([]);
    expect(placeholderFor(p("number"), "C")).toBe(0);
    expect(placeholderFor(p("boolean"), "C")).toBe(false);
    expect(placeholderFor(p("string", "label"), "C")).toBe("label");
    expect(placeholderFor(p("ReactNode", "children"), "Card")).toBe("Card");
    expect(placeholderFor(p('"sm" | "md"'), "C")).toBe("sm");
    expect(placeholderFor(p("(v: string) => void"), "C")).toBeUndefined();
  });
});

describe("defaultProps on real registry entries", () => {
  it("seeds shell-onboarding (Onboarding Shell) with the example's steps", () => {
    const props = seed("shell-onboarding");
    const steps = props.steps as { id: string; title: string }[];
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBe(4);
    expect(steps[0]).toMatchObject({ id: "company", title: "Your company", minutes: 2 });
    // functions, JSX and state never leak into the props
    expect(JSON.stringify(props)).not.toMatch(/=>|<div/);
    expect(props.onExit).toBeUndefined();
    expect(props.brand).toBeUndefined();
  });

  it("fills every required array prop for a sample of components", () => {
    for (const slug of ["activity-timeline", "onboarding-checklist", "onboarding-wizard"]) {
      const d = registry(slug);
      const props = seed(slug);
      for (const p of d.props ?? []) {
        if (p.required && /\[\]$|^Array</.test(p.type.trim()))
          expect(Array.isArray(props[p.name]), `${slug}.${p.name}`).toBe(true);
      }
    }
  });

  it("gives every registry entry's required non-callback props a value", () => {
    const slugs = registrySlugs();
    expect(slugs.length).toBeGreaterThan(30);
    const gaps: string[] = [];
    for (const slug of slugs) {
      const d = registry(slug);
      const props = seed(slug);
      for (const p of d.props ?? []) {
        if (!p.required || p.type.includes("=>") || !/^[A-Za-z_$][\w$]*$/.test(p.name)) continue;
        if (/\[\]$|^Array</.test(p.type.trim()) && !Array.isArray(props[p.name]))
          gaps.push(`${slug}.${p.name}`);
      }
    }
    expect(gaps).toEqual([]);
  });
});
