import type { DiscordChannel, DiscordRole } from "@/lib/discord";

const STYLES = {
  field: "flex flex-col gap-1.5",
  label: "text-sm font-medium text-[var(--text)]",
  description: "text-sm text-[var(--text-muted)]",
  select:
    "cursor-pointer appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-light)] bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%207.5%2010%2012.5%2015%207.5%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px] bg-[right_1rem_center] pl-3 pr-9 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
  input:
    "rounded-lg border border-[var(--border)] bg-[var(--bg-light)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
  textarea:
    "resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-light)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]",
  textareaMinHeight: "min-h-24",
  checkboxRow: "flex items-center justify-between gap-4",
  checkboxText: "flex flex-col gap-1",
  toggleLabel: "relative inline-flex h-6 w-11 shrink-0 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
  toggleTrack:
    "absolute inset-0 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)]",
  toggleKnob:
    "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 translate-x-0 rounded-full bg-[var(--bg)] shadow transition-transform peer-checked:translate-x-5",
  toggleInput: "peer sr-only",
};

function FieldShell({
  label,
  description,
  children,
}: {
  label?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={STYLES.field}>
      {label && <label className={STYLES.label}>{label}</label>}
      {description && <p className={STYLES.description}>{description}</p>}
      {children}
    </div>
  );
}

export function ChannelField({
  label,
  description,
  name,
  defaultValue,
  channels,
  onChange,
  disabled,
}: {
  label?: string;
  description?: string;
  name: string;
  defaultValue: string | null;
  channels: DiscordChannel[];
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label} description={description}>
      <select
        key={defaultValue ?? ""}
        name={name}
        aria-label={label ?? name}
        defaultValue={defaultValue ?? ""}
        className={STYLES.select}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
      >
        <option value="">None</option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.name}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function RoleField({
  label,
  description,
  name,
  defaultValue,
  roles,
  onChange,
}: {
  label?: string;
  description?: string;
  name: string;
  defaultValue: string | null;
  roles: DiscordRole[];
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} description={description}>
      <select
        key={defaultValue ?? ""}
        name={name}
        aria-label={label ?? name}
        defaultValue={defaultValue ?? ""}
        className={STYLES.select}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        <option value="">None</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SelectField({
  label,
  description,
  name,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} description={description}>
      <select
        key={defaultValue ?? ""}
        name={name}
        defaultValue={defaultValue}
        className={STYLES.select}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  description,
  name,
  defaultValue,
  onChange,
  minHeightClassName,
}: {
  label: string;
  description?: string;
  name: string;
  defaultValue: string;
  onChange?: (value: string) => void;
  minHeightClassName?: string;
}) {
  return (
    <FieldShell label={label} description={description}>
      <textarea
        name={name}
        defaultValue={defaultValue}
        className={[STYLES.textarea, minHeightClassName ?? STYLES.textareaMinHeight].join(" ")}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </FieldShell>
  );
}

export function TextField({
  label,
  description,
  name,
  defaultValue,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  name: string;
  defaultValue: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label} description={description}>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ""}
        className={STYLES.input}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
      />
    </FieldShell>
  );
}

export function ToggleField({
  label,
  description,
  name,
  defaultChecked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  name: string;
  defaultChecked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={STYLES.checkboxRow}>
      <div className={STYLES.checkboxText}>
        <label htmlFor={name} className={STYLES.label}>
          {label}
        </label>
        {description && <p className={STYLES.description}>{description}</p>}
      </div>
      <label className={STYLES.toggleLabel}>
        <input
          type="checkbox"
          id={name}
          name={name}
          defaultChecked={defaultChecked}
          className={STYLES.toggleInput}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          disabled={disabled}
        />
        <span className={STYLES.toggleTrack} />
        <span className={STYLES.toggleKnob} />
      </label>
    </div>
  );
}
