import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Controller, type Control, type FieldError } from "react-hook-form";
import { FileText, Star, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fileMatchesAccept,
  type FormField,
  type FormValues,
} from "@/components/crm/pro-form-renderer/schema";

export const controlClass = cn(
  "h-9 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-3 font-crm text-sm text-crm-fg placeholder:text-crm-subtle",
  "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
  "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40",
  "aria-[invalid=true]:border-crm-danger disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]",
);

const choiceClass =
  "size-4 shrink-0 cursor-pointer accent-[var(--crm-primary,#6147ff)] disabled:cursor-not-allowed";

export interface FieldRenderProps {
  field: FormField;
  control: Control<FormValues>;
  disabled?: boolean;
  /** Prefix for DOM ids so several forms can live on one page. */
  idPrefix: string;
}

function Message({ id, error, hint }: { id: string; error?: FieldError; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={cn("text-xs", error ? "text-crm-danger" : "text-crm-subtle")}
    >
      {error?.message ?? hint}
    </p>
  );
}

/** One schema field bound to react-hook-form, with label, hint and error wiring. */
export const FieldRenderer = React.memo(function FieldRenderer({
  field: f,
  control,
  disabled,
  idPrefix,
}: FieldRenderProps) {
  const id = `${idPrefix}-${f.name}`;
  const msgId = `${id}-msg`;

  if (f.type === "heading") {
    return (
      <div className="col-span-2 border-b border-crm-border pt-2 pb-1">
        <h3 className="font-crm text-sm font-semibold text-crm-fg">{f.label}</h3>
        {f.helpText ? <p className="mt-0.5 text-xs text-crm-subtle">{f.helpText}</p> : null}
      </div>
    );
  }

  return (
    <Controller
      name={f.name}
      control={control}
      render={({ field, fieldState }) => {
        const invalid = !!fieldState.error;
        const describedBy = fieldState.error || f.helpText ? msgId : undefined;
        const common = {
          id,
          disabled,
          "aria-invalid": invalid || undefined,
          "aria-describedby": describedBy,
          "aria-required": f.required || undefined,
        };
        const isGroup =
          f.type === "radio" ||
          f.type === "rating" ||
          ((f.type === "checkbox" || f.type === "multiselect") && (f.options?.length ?? 0) > 0);
        const label = (
          <>
            {f.label}
            {f.required ? (
              <span className="text-crm-danger" aria-hidden>
                {" "}
                *
              </span>
            ) : null}
          </>
        );

        let control: React.ReactNode;
        switch (f.type) {
          case "textarea":
            control = (
              <textarea
                {...common}
                ref={field.ref}
                name={field.name}
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={f.placeholder}
                rows={4}
                className={cn(controlClass, "h-auto min-h-24 resize-y py-2")}
              />
            );
            break;
          case "select":
            control = (
              <select
                {...common}
                ref={field.ref}
                name={field.name}
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                className={cn(controlClass, "cursor-pointer pr-8")}
              >
                <option value="">{f.placeholder || "Select…"}</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
            break;
          case "radio":
          case "multiselect":
          case "checkbox": {
            if (f.type === "checkbox" && !f.options?.length) {
              control = null;
              break;
            }
            const multi = f.type !== "radio";
            const current = multi ? ((field.value as string[]) ?? []) : (field.value as string);
            control = (
              <div
                role={multi ? "group" : "radiogroup"}
                aria-labelledby={`${id}-label`}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(
                  "grid gap-1.5",
                  (f.options?.length ?? 0) > 4 ? "sm:grid-cols-2" : "grid-cols-1",
                )}
              >
                {f.options?.map((o, i) => {
                  const checked = multi
                    ? (current as string[]).includes(o.value)
                    : current === o.value;
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-crm border px-3 py-2 text-sm text-crm-fg transition-colors",
                        checked
                          ? "border-crm-primary/70 bg-crm-primary/10"
                          : "border-crm-border bg-crm-raised hover:border-crm-input",
                        disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input
                        ref={i === 0 ? field.ref : undefined}
                        type={multi ? "checkbox" : "radio"}
                        name={field.name}
                        value={o.value}
                        checked={checked}
                        disabled={disabled}
                        onBlur={field.onBlur}
                        onChange={(e) => {
                          if (!multi) return field.onChange(o.value);
                          const set = new Set(current as string[]);
                          if (e.target.checked) set.add(o.value);
                          else set.delete(o.value);
                          field.onChange(
                            (f.options ?? []).map((x) => x.value).filter((x) => set.has(x)),
                          );
                        }}
                        className={choiceClass}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            );
            break;
          }
          case "rating": {
            const max = f.validation?.max ?? 5;
            const value = (field.value as number | undefined) ?? 0;
            control = (
              <RatingInput
                id={id}
                max={max}
                value={value}
                disabled={disabled}
                invalid={invalid}
                describedBy={describedBy}
                labelledBy={`${id}-label`}
                onChange={(n) => field.onChange(n)}
                onBlur={field.onBlur}
                inputRef={field.ref}
              />
            );
            break;
          }
          case "file":
            control = (
              <FileDrop
                id={id}
                field={f}
                files={(field.value as File[]) ?? []}
                disabled={disabled}
                invalid={invalid}
                describedBy={describedBy}
                onChange={(files) => field.onChange(files)}
                onBlur={field.onBlur}
              />
            );
            break;
          case "number":
            control = (
              <input
                {...common}
                ref={field.ref}
                name={field.name}
                type="number"
                inputMode="decimal"
                min={f.validation?.min}
                max={f.validation?.max}
                value={field.value === undefined || field.value === null ? "" : String(field.value)}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                }
                onBlur={field.onBlur}
                placeholder={f.placeholder}
                className={controlClass}
              />
            );
            break;
          default:
            control = (
              <input
                {...common}
                ref={field.ref}
                name={field.name}
                type={
                  f.type === "phone"
                    ? "tel"
                    : f.type === "email" || f.type === "url" || f.type === "date"
                      ? f.type
                      : "text"
                }
                autoComplete={f.type === "email" ? "email" : f.type === "phone" ? "tel" : undefined}
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={f.placeholder}
                className={controlClass}
              />
            );
        }

        const single = f.type === "consent" || (f.type === "checkbox" && !f.options?.length);
        return (
          <div
            className={cn(
              "flex min-w-0 flex-col gap-1.5 font-crm",
              f.width === "half" ? "col-span-2 sm:col-span-1" : "col-span-2",
            )}
          >
            {single ? (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-crm-fg">
                <input
                  {...common}
                  ref={field.ref}
                  type="checkbox"
                  name={field.name}
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  className={cn(choiceClass, "mt-0.5")}
                />
                <span>{label}</span>
              </label>
            ) : isGroup ? (
              <span id={`${id}-label`} className="text-xs font-medium text-crm-soft">
                {label}
              </span>
            ) : (
              <label id={`${id}-label`} htmlFor={id} className="text-xs font-medium text-crm-soft">
                {label}
              </label>
            )}
            {control}
            <Message id={msgId} error={fieldState.error} hint={f.helpText} />
          </div>
        );
      }}
    />
  );
});

interface RatingProps {
  id: string;
  max: number;
  value: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  labelledBy: string;
  onChange: (n: number) => void;
  onBlur: () => void;
  inputRef: React.Ref<HTMLButtonElement>;
}

/** Star rating as an ARIA radiogroup with roving tabindex and arrow-key support. */
function RatingInput({
  id,
  max,
  value,
  disabled,
  invalid,
  describedBy,
  labelledBy,
  onChange,
  onBlur,
  inputRef,
}: RatingProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = React.useState(0);
  const focusIndex = value > 0 ? value - 1 : 0;
  const move = (n: number) => {
    const next = Math.min(max, Math.max(1, n));
    onChange(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const lit = (hover || value) >= n;
        return (
          <button
            key={n}
            id={i === 0 ? id : undefined}
            ref={(el) => {
              refs.current[i] = el;
              if (i === focusIndex && typeof inputRef === "function") inputRef(el);
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of ${max}`}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onBlur={onBlur}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight" || e.key === "ArrowUp"
                  ? n + 1
                  : e.key === "ArrowLeft" || e.key === "ArrowDown"
                    ? n - 1
                    : e.key === "Home"
                      ? 1
                      : e.key === "End"
                        ? max
                        : null;
              if (next === null) return;
              e.preventDefault();
              move(next);
            }}
            className="cursor-pointer rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed"
          >
            <Star
              className={cn(
                "size-5 transition-colors",
                lit ? "fill-crm-warning text-crm-warning" : "text-crm-subtle",
              )}
            />
          </button>
        );
      })}
      <span className="ml-2 text-xs text-crm-subtle tabular-nums">
        {value ? `${value}/${max}` : "Not rated"}
      </span>
    </div>
  );
}

const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;

interface FileDropProps {
  id: string;
  field: FormField;
  files: File[];
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (files: File[]) => void;
  onBlur: () => void;
}

/** react-dropzone backed file field: drag/drop or browse, per-file size/type checks, removable list. */
function FileDrop({
  id,
  field: f,
  files,
  disabled,
  invalid,
  describedBy,
  onChange,
  onBlur,
}: FileDropProps) {
  const [rejections, setRejections] = React.useState<string[]>([]);
  const maxFiles = f.file?.maxFiles ?? 1;
  const maxSize = f.file?.maxSizeMb ? f.file.maxSizeMb * 1024 * 1024 : undefined;
  const onDrop = React.useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const ok = accepted.filter((file) => fileMatchesAccept(file, f.file?.accept));
      const wrongType = accepted.filter((file) => !ok.includes(file));
      const next = maxFiles === 1 ? ok.slice(0, 1) : [...files, ...ok].slice(0, maxFiles);
      const msgs = [
        ...rejected.map((r) => `${r.file.name}: ${r.errors[0]?.message ?? "rejected"}`),
        ...wrongType.map((file) => `${file.name}: file type not accepted`),
      ];
      if (maxFiles > 1 && files.length + ok.length > maxFiles)
        msgs.push(`Only ${maxFiles} files allowed`);
      setRejections(msgs);
      onChange(next);
      onBlur();
    },
    [files, maxFiles, onChange, onBlur, f.file?.accept],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    maxSize,
    multiple: maxFiles > 1,
    disabled,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps()}
        aria-describedby={describedBy}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-crm border border-dashed px-4 py-5 text-center transition-colors",
          isDragActive
            ? "border-crm-primary bg-crm-primary/10"
            : invalid
              ? "border-crm-danger/70 bg-crm-raised"
              : "border-crm-input/60 bg-crm-raised",
          disabled && "opacity-50",
        )}
      >
        <input {...getInputProps({ accept: f.file?.accept?.join(",") })} id={`${id}-input`} />
        <UploadCloud className="size-5 text-crm-muted-fg" aria-hidden />
        <p className="text-sm text-crm-fg">
          {isDragActive ? "Drop to upload" : "Drag files here or "}
          {!isDragActive ? (
            <button
              id={id}
              type="button"
              onClick={open}
              disabled={disabled}
              className="cursor-pointer font-medium text-crm-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              browse
            </button>
          ) : null}
        </p>
        <p className="text-xs text-crm-subtle">
          {[
            f.file?.accept?.length ? f.file.accept.join(", ") : "Any file type",
            f.file?.maxSizeMb ? `up to ${f.file.maxSizeMb} MB` : null,
            maxFiles > 1 ? `max ${maxFiles} files` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {rejections.length ? (
        <ul className="text-xs text-crm-danger" aria-live="polite">
          {rejections.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      {files.length ? (
        <ul className="flex flex-col gap-1" aria-label="Selected files">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-crm border border-crm-border bg-crm-card px-2.5 py-1.5 text-xs"
            >
              <FileText className="size-3.5 shrink-0 text-crm-muted-fg" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-crm-fg">{file.name}</span>
              <span className="text-crm-subtle tabular-nums">{formatBytes(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="cursor-pointer rounded-full p-0.5 text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
