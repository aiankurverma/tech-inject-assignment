import * as React from "react";
import { useStore } from "zustand";
import type { WorkflowState, WorkflowStore } from "@/components/crm/pro-workflow-builder/store";
import type { NodeDefinition, NodeRunState } from "@/components/crm/pro-workflow-builder/types";
import type { DefMap, Issue } from "@/components/crm/pro-workflow-builder/validation";

export interface BuilderContextValue {
  store: WorkflowStore;
  defs: DefMap;
  runState?: Record<string, NodeRunState>;
  issuesByNode: ReadonlyMap<string, Issue[]>;
  readOnly: boolean;
}

export const BuilderContext = React.createContext<BuilderContextValue | null>(null);

export function useBuilder() {
  const ctx = React.useContext(BuilderContext);
  if (!ctx)
    throw new Error("ProWorkflowBuilder parts must be rendered inside <ProWorkflowBuilder>");
  return ctx;
}

export function useWorkflow<T>(selector: (s: WorkflowState) => T): T {
  return useStore(useBuilder().store, selector);
}

export function useDefinition(type: string): NodeDefinition | undefined {
  return useBuilder().defs.get(type);
}
