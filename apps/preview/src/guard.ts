import { Component, createElement, type ReactNode } from "react";

/**
 * Per-node boundary used by generated pages (builder, prompt to screen): a broken component
 * shows an inline error box in its place and the rest of the page keeps rendering.
 * Registered as `globalThis.KitbasePreviewGuard` (see PREVIEW_GUARD_PRELUDE in @ti/core).
 */
export class KitbasePreviewGuard extends Component<
  { label?: string; children?: ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children ?? null;
    const { label } = this.props;
    return createElement(
      "div",
      {
        role: "alert",
        "data-kitbase-guard": label ?? "",
        style: {
          border: "1px dashed #f97373",
          borderRadius: 6,
          color: "#f97373",
          fontFamily: "monospace",
          fontSize: 12,
          padding: 12,
        },
      },
      `${label ? `${label}: ` : ""}${error.message}`,
    );
  }
}

export function registerPreviewGuard(target: object = globalThis) {
  (target as { KitbasePreviewGuard?: unknown }).KitbasePreviewGuard = KitbasePreviewGuard;
}
