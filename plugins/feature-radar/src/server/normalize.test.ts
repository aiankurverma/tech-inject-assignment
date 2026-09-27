import { describe, expect, it } from "vitest";
import { normalizeTerm, publicInterest } from "./normalize";

describe("normalizeTerm", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeTerm("  hello  ")).toBe("hello");
  });

  it("lowercases all characters", () => {
    expect(normalizeTerm("React Router")).toBe("react router");
  });

  it("collapses multiple spaces to one", () => {
    expect(normalizeTerm("hello   world")).toBe("hello world");
  });

  it("handles tabs and mixed whitespace", () => {
    expect(normalizeTerm("data\t\tviz")).toBe("data viz");
  });

  it("applies all transformations together", () => {
    expect(normalizeTerm("  Data  Viz  ")).toBe("data viz");
  });

  it("preserves allowed special characters", () => {
    expect(normalizeTerm("drag-and-drop & gestures.")).toBe("drag-and-drop & gestures.");
  });
});

describe("publicInterest", () => {
  it("returns null for count below 5", () => {
    expect(publicInterest(0)).toBeNull();
    expect(publicInterest(1)).toBeNull();
    expect(publicInterest(4)).toBeNull();
  });

  it("returns null for count exactly 4", () => {
    expect(publicInterest(4)).toBeNull();
  });

  it("returns the real count when exactly 5", () => {
    expect(publicInterest(5)).toBe(5);
  });

  it("returns the real count when well above 5", () => {
    expect(publicInterest(42)).toBe(42);
    expect(publicInterest(1000)).toBe(1000);
  });
});
