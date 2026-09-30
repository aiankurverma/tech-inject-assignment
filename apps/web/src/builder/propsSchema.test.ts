import { describe, expect, it } from "vitest";
import { coerce, fieldsFromProps, kindOf, literalOptions, parseDefault } from "./propsSchema";

describe("kindOf", () => {
  it("maps type strings to field kinds", () => {
    expect(kindOf("boolean")).toEqual({ kind: "boolean" });
    expect(kindOf("number")).toEqual({ kind: "number" });
    expect(kindOf("0 | 1")).toEqual({ kind: "number" });
    expect(kindOf("string")).toEqual({ kind: "text" });
    expect(kindOf("ReactNode")).toEqual({ kind: "text" });
    expect(kindOf("string | null")).toEqual({ kind: "text" });
    expect(kindOf("string[]")).toEqual({ kind: "list" });
    expect(kindOf('"sm" | "md" | "lg"')).toEqual({ kind: "select", options: ["sm", "md", "lg"] });
    expect(kindOf("'a' | 'b' | undefined")).toEqual({ kind: "select", options: ["a", "b"] });
    expect(kindOf("() => void")).toBeNull();
    expect(kindOf("(id: string) => void")).toBeNull();
    expect(kindOf("Date")).toBeNull();
    expect(kindOf("Record<string, number>")).toBeNull();
    expect(literalOptions('"a" | b')).toBeNull();
  });
});

describe("parseDefault", () => {
  it("parses documented defaults", () => {
    expect(parseDefault('"md"', "select")).toBe("md");
    expect(parseDefault("false", "boolean")).toBe(false);
    expect(parseDefault("3", "number")).toBe(3);
    expect(parseDefault('["a"]', "list")).toEqual(["a"]);
    expect(parseDefault("'sm'", "text")).toBe("sm");
    expect(parseDefault(undefined, "text")).toBeUndefined();
    expect(parseDefault("false", "number")).toBeUndefined();
    expect(parseDefault("{ a: 1 }", "number")).toBeUndefined();
  });
});

describe("fieldsFromProps", () => {
  it("keeps editable props and drops the rest", () => {
    const fields = fieldsFromProps([
      {
        name: "variant",
        type: '"primary" | "ghost"',
        default: '"ghost"',
        required: false,
        description: "Style",
      },
      { name: "loading", type: "boolean", default: "false", required: false, description: "" },
      { name: "onClick", type: "() => void", required: false, description: "" },
      { name: "label (IconButton)", type: "string", required: true, description: "" },
      { name: "className", type: "string", required: false, description: "" },
      { name: "tags", type: "string[]", required: false, description: "" },
      { name: "value", type: "Date", required: true, description: "" },
    ]);
    expect(fields.map((f) => f.name)).toEqual(["variant", "loading", "tags"]);
    expect(fields[0]).toEqual({
      name: "variant",
      kind: "select",
      options: ["primary", "ghost"],
      description: "Style",
      default: "ghost",
      required: false,
    });
    expect(fieldsFromProps(undefined)).toEqual([]);
  });
});

describe("coerce", () => {
  const f = (kind: "text" | "number" | "boolean" | "select" | "list") => ({
    name: "x",
    kind,
    description: "",
    required: false,
  });
  it("converts input strings to prop values", () => {
    expect(coerce(f("number"), "12")).toBe(12);
    expect(coerce(f("number"), "")).toBeUndefined();
    expect(coerce(f("number"), "abc")).toBeUndefined();
    expect(coerce(f("boolean"), "true")).toBe(true);
    expect(coerce(f("boolean"), "false")).toBe(false);
    expect(coerce(f("list"), "a, b\nc")).toEqual(["a", "b", "c"]);
    expect(coerce(f("text"), "")).toBeUndefined();
    expect(coerce(f("select"), "md")).toBe("md");
  });
});
