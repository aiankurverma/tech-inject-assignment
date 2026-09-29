import * as React from "react";
import type {
  BoardIndex,
  PipelineDeal,
  PipelineOwner,
  PipelineStage,
} from "@/components/crm/pro-pipeline-board/model";

/** Row height of a virtualised card slot (card + gap). Fixed so hit-testing stays O(1). */
export const CARD_ROW = 100;
export const COLUMN_WIDTH = 288;

export interface BoardContextValue {
  stages: readonly PipelineStage[];
  stageById: Map<string, PipelineStage>;
  ownerById: Map<string, PipelineOwner>;
  index: BoardIndex;
  byOwner: boolean;
  currency: string;
  locale: string;
  now: number;
  readOnly: boolean;
  instructionsId: string;
  /** Last focus request a card honoured, so remounts do not steal focus. */
  focusHandled: React.MutableRefObject<number>;
  onCardPointerDown: (e: React.PointerEvent<HTMLElement>, deal: PipelineDeal) => void;
  renderCardExtra?: (deal: PipelineDeal) => React.ReactNode;
}

export const BoardContext = React.createContext<BoardContextValue | null>(null);

export function useBoard() {
  const ctx = React.useContext(BoardContext);
  if (!ctx) throw new Error("Pipeline board parts must be rendered inside ProPipelineBoard");
  return ctx;
}
