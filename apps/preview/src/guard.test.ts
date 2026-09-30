import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { KitbasePreviewGuard, registerPreviewGuard } from "./guard";

describe("KitbasePreviewGuard", () => {
  it("renders its children while nothing has thrown", () => {
    const g = new KitbasePreviewGuard({ label: "x", children: "ok" });
    expect(g.render()).toBe("ok");
  });

  it("turns a render error into an inline alert for that node only", () => {
    const g = new KitbasePreviewGuard({ label: "shell-onboarding", children: "ok" });
    g.state = KitbasePreviewGuard.getDerivedStateFromError(
      new TypeError("Cannot read properties of undefined (reading 'length')"),
    );
    const out = g.render();
    expect(isValidElement(out)).toBe(true);
    const el = out as ReactElement<{
      role: string;
      children: string;
      "data-kitbase-guard": string;
    }>;
    expect(el.type).toBe("div");
    expect(el.props.role).toBe("alert");
    expect(el.props["data-kitbase-guard"]).toBe("shell-onboarding");
    expect(el.props.children).toBe(
      "shell-onboarding: Cannot read properties of undefined (reading 'length')",
    );
  });

  it("wraps non-Error throws", () => {
    expect(KitbasePreviewGuard.getDerivedStateFromError("boom").error.message).toBe("boom");
  });

  it("registers itself globally for generated preview code", () => {
    const target: { KitbasePreviewGuard?: unknown } = {};
    registerPreviewGuard(target);
    expect(target.KitbasePreviewGuard).toBe(KitbasePreviewGuard);
  });
});
