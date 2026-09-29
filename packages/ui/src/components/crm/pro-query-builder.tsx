import * as React from "react";
import { AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { QueryBuilder, generateID, type Field, type RuleGroupType } from "react-querybuilder";
import { cn } from "@/lib/utils";
import {
  countRules,
  defaultValueFor,
  toRqbFields,
  validateQuery,
  type QueryExportFormat,
  type QueryField,
  type SavedSegment,
} from "@/lib/pro-query-builder";
import {
  DragProvider,
  DraggableRule,
  DraggableRuleGroup,
  ProActionElement,
  ProCombinator,
  ProNotToggle,
  ProShiftActions,
  ProValueSelector,
} from "@/components/crm/pro-query-builder/controls";
import { ProValueEditor, type QbContext } from "@/components/crm/pro-query-builder/value-editor";
import { ExportPanel } from "@/components/crm/pro-query-builder/export-panel";
import { SavedSegments } from "@/components/crm/pro-query-builder/saved-segments";

export type {
  QueryExportFormat,
  QueryField,
  QueryFieldType,
  SavedSegment,
} from "@/lib/pro-query-builder";
export { exportQuery, validateQuery, resolveQuery } from "@/lib/pro-query-builder";
export type { RuleGroupType } from "react-querybuilder";

export interface ProQueryBuilderProps {
  /** Filterable fields; `type` drives operators, value editor, validation and export. */
  fields: QueryField[];
  /** Controlled query. */
  query?: RuleGroupType;
  /** Initial query when uncontrolled. */
  defaultQuery?: RuleGroupType;
  onQueryChange?: (query: RuleGroupType) => void;
  /** Called by the Apply button with the (valid) query. Omit to hide the button. */
  onApply?: (query: RuleGroupType) => void;
  /** Controlled saved segments. */
  segments?: SavedSegment[];
  defaultSegments?: SavedSegment[];
  onSegmentsChange?: (segments: SavedSegment[]) => void;
  /** Export tabs to show; pass [] to hide the export panel. */
  exportFormats?: QueryExportFormat[];
  /** Maximum group nesting depth. */
  maxDepth?: number;
  /** Show NOT toggles on groups. */
  allowNot?: boolean;
  disabled?: boolean;
  /** Live preview of how many records match, e.g. from a debounced count query. */
  matchCount?: number | null;
  matchCountLoading?: boolean;
  className?: string;
}

const EMPTY_QUERY: RuleGroupType = { combinator: "and", rules: [] };
const DEFAULT_FORMATS: QueryExportFormat[] = ["sql", "mongodb", "jsonlogic", "json"];
const COMBINATORS = [
  { name: "and", value: "and", label: "And" },
  { name: "or", value: "or", label: "Or" },
];

const CLASSNAMES = {
  queryBuilder: "text-crm-fg",
  ruleGroup:
    "flex flex-1 min-w-0 flex-col gap-2 rounded-crm border border-crm-border bg-crm-card/60 p-2.5 [&_&]:bg-crm-bg/40",
  header: "flex flex-wrap items-center gap-1.5",
  body: "flex flex-col gap-2 border-l border-crm-border pl-2.5 empty:hidden",
  rule: "flex flex-1 flex-wrap items-start gap-1.5",
  betweenRules: "hidden",
};

/** Controlled-or-uncontrolled state helper. */
function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = React.useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [current, set] as const;
}

/** Nested AND/OR segment builder on react-querybuilder with typed editors, validation, exports and saved segments. */
export function ProQueryBuilder({
  fields,
  query: queryProp,
  defaultQuery = EMPTY_QUERY,
  onQueryChange,
  onApply,
  segments: segmentsProp,
  defaultSegments = [],
  onSegmentsChange,
  exportFormats = DEFAULT_FORMATS,
  maxDepth = 4,
  allowNot = true,
  disabled,
  matchCount,
  matchCountLoading,
  className,
}: ProQueryBuilderProps) {
  const [query, setQuery] = useControllable(queryProp, defaultQuery, onQueryChange);
  const [segments, setSegments] = useControllable(segmentsProp, defaultSegments, onSegmentsChange);
  const [activeSegment, setActiveSegment] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);

  const rqbFields = React.useMemo<Field[]>(() => toRqbFields(fields), [fields]);
  const fieldsByName = React.useMemo(() => new Map(fields.map((f) => [f.name, f])), [fields]);
  const issues = React.useMemo(() => validateQuery(query, fields), [query, fields]);
  const issueCount = Object.keys(issues).length;
  const ruleCount = React.useMemo(() => countRules(query), [query]);
  const valid = issueCount === 0 && ruleCount > 0;

  const context = React.useMemo<QbContext>(
    () => ({ fieldsByName, issues, showErrors: touched }),
    [fieldsByName, issues, touched],
  );

  const getDefaultValue = React.useCallback(
    ({ field, operator }: { field: string; operator: string }) =>
      defaultValueFor(fieldsByName.get(field), operator),
    [fieldsByName],
  );

  const controlElements = React.useMemo(
    () => ({
      actionElement: ProActionElement,
      valueSelector: ProValueSelector,
      combinatorSelector: ProCombinator,
      notToggle: allowNot ? ProNotToggle : null,
      shiftActions: ProShiftActions,
      valueEditor: ProValueEditor,
      rule: DraggableRule,
      ruleGroup: DraggableRuleGroup,
      dragHandle: null,
    }),
    [allowNot],
  );

  const apply = () => {
    setTouched(true);
    if (valid) onApply?.(query);
  };

  return (
    <div
      className={cn(
        "grid gap-3 rounded-crm border border-crm-border bg-crm-card p-3 text-crm-fg shadow-crm-raised lg:grid-cols-[minmax(0,1fr)_300px]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-crm-muted-fg" aria-live="polite">
            <span>
              {ruleCount} condition{ruleCount === 1 ? "" : "s"}
            </span>
            {touched && issueCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-crm-danger">
                <AlertCircle className="size-3.5" /> {issueCount} to fix
              </span>
            ) : ruleCount > 0 && issueCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-crm-success">
                <CheckCircle2 className="size-3.5" /> Valid
              </span>
            ) : null}
            {matchCount !== undefined && (
              <span className="rounded-full bg-crm-muted px-2 py-0.5 text-crm-fg tabular-nums">
                {matchCountLoading
                  ? "Counting..."
                  : matchCount === null
                    ? "-"
                    : `${matchCount.toLocaleString()} match`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled || ruleCount === 0}
              onClick={() => {
                setQuery({ ...EMPTY_QUERY, id: generateID() });
                setActiveSegment(null);
                setTouched(false);
              }}
              className="inline-flex h-[30px] items-center gap-1 rounded-full px-2.5 text-xs text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" /> Clear
            </button>
            {onApply && (
              <button
                type="button"
                disabled={disabled}
                onClick={apply}
                className="inline-flex h-[30px] items-center rounded-full bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg shadow-crm-primary outline-none hover:bg-[#5237ff] focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40"
              >
                Apply segment
              </button>
            )}
          </div>
        </div>

        <DragProvider>
          <QueryBuilder
            fields={rqbFields}
            query={query}
            onQueryChange={setQuery}
            combinators={COMBINATORS}
            controlElements={controlElements}
            controlClassnames={CLASSNAMES}
            context={context}
            getDefaultValue={getDefaultValue}
            resetOnOperatorChange
            listsAsArrays
            showShiftActions
            showNotToggle={allowNot}
            maxLevels={maxDepth}
            disabled={disabled}
            translations={{
              addRule: { label: "Condition", title: "Add condition" },
              addGroup: { label: "Group", title: "Add group" },
              removeRule: { label: "", title: "Remove condition" },
              removeGroup: { label: "", title: "Remove group" },
              fields: { title: "Field" },
              operators: { title: "Operator" },
              combinators: { title: "Match" },
            }}
          />
        </DragProvider>

        {ruleCount === 0 && (
          <p className="rounded-crm border border-dashed border-crm-border px-3 py-6 text-center text-xs text-crm-subtle">
            No conditions yet. Add a condition to start building a segment, or load a saved one.
          </p>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-3 lg:border-l lg:border-crm-border lg:pl-3">
        <SavedSegments
          segments={segments}
          activeId={activeSegment}
          canSave={valid}
          disabled={disabled}
          onLoad={(s) => {
            setQuery(s.query);
            setActiveSegment(s.id);
            setTouched(false);
          }}
          onSave={(name, overwriteId) => {
            const now = new Date().toISOString();
            if (overwriteId) {
              setSegments(
                segments.map((s) =>
                  s.id === overwriteId ? { ...s, name, query, updatedAt: now } : s,
                ),
              );
            } else {
              const id = generateID();
              setSegments([{ id, name, query, updatedAt: now }, ...segments]);
              setActiveSegment(id);
            }
          }}
          onDelete={(id) => {
            setSegments(segments.filter((s) => s.id !== id));
            if (id === activeSegment) setActiveSegment(null);
          }}
        />
        {exportFormats.length > 0 && (
          <ExportPanel query={query} formats={exportFormats} valid={issueCount === 0} />
        )}
      </aside>
    </div>
  );
}
