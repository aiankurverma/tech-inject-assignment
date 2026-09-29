import * as React from "react";
import {
  CRON_FIELD_SPECS,
  describeCron,
  getNextRuns,
  parseExpression,
  serializeField,
  validateCron,
  validateFields,
  type CronFieldKey,
  type CronFieldValue,
  type CronFields,
} from "@/components/crm/pro-cron-builder/cron-model";

export interface UseCronScheduleOptions {
  value?: string;
  defaultValue?: string;
  onChange?: (expression: string, meta: { valid: boolean; error?: string }) => void;
  timezone: string;
  runCount: number;
  use24HourTimeFormat?: boolean;
}

/**
 * State machine behind ProCronBuilder: controlled/uncontrolled expression, visual fields derived
 * from it, validation, description and next runs. Heavy work (parsing, iteration) is memoised and
 * the preview is computed from a deferred value so typing stays responsive.
 */
export function useCronSchedule({
  value,
  defaultValue = "0 9 * * 1-5",
  onChange,
  timezone,
  runCount,
  use24HourTimeFormat = true,
}: UseCronScheduleOptions) {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const expression = controlled ? value : inner;

  const fields = React.useMemo(() => parseExpression(expression), [expression]);
  const fieldErrors = React.useMemo(() => (fields ? validateFields(fields) : {}), [fields]);
  const validation = React.useMemo(() => {
    const first = Object.values(fieldErrors)[0];
    if (first) return { valid: false, error: first };
    return validateCron(expression, timezone);
  }, [expression, fieldErrors, timezone]);

  const deferred = React.useDeferredValue(expression);
  const description = React.useMemo(
    () => (validation.valid ? describeCron(deferred, { use24HourTimeFormat }) : ""),
    [deferred, validation.valid, use24HourTimeFormat],
  );
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const nextRuns = React.useMemo(
    () =>
      validation.valid ? getNextRuns(deferred, { count: runCount, tz: timezone, from: now }) : [],
    [deferred, validation.valid, runCount, timezone, now],
  );

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const setExpression = React.useCallback(
    (next: string) => {
      if (!controlled) setInner(next);
      const v = validateCron(next, timezone);
      onChangeRef.current?.(next, v);
    },
    [controlled, timezone],
  );

  const setField = React.useCallback(
    (key: CronFieldKey, fieldValue: CronFieldValue) => {
      const base: CronFields = fields ?? (parseExpression("* * * * *") as CronFields);
      const next = { ...base, [key]: fieldValue };
      setExpression(CRON_FIELD_SPECS.map((s) => serializeField(next[s.key], s)).join(" "));
    },
    [fields, setExpression],
  );

  return {
    expression,
    fields,
    fieldErrors,
    validation,
    description,
    nextRuns,
    setExpression,
    setField,
  };
}
