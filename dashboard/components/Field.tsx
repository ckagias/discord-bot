import type { DiscordChannel, DiscordRole } from "@/lib/discord";

const STYLES = {
  field: "flex flex-col gap-1.5",
  label: "text-sm font-medium text-black dark:text-zinc-50",
  description: "text-sm text-zinc-500 dark:text-zinc-400",
  select:
    "cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  input:
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  textarea:
    "min-h-24 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-[#5865F2] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
  checkboxRow: "flex items-center justify-between gap-4",
  checkboxText: "flex flex-col gap-1",
  toggleLabel: "relative inline-flex h-6 w-11 shrink-0 cursor-pointer",
  toggleTrack:
    "absolute inset-0 rounded-full bg-zinc-300 transition-colors peer-checked:bg-[#5865F2] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#5865F2] dark:bg-zinc-700",
  toggleKnob:
    "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 translate-x-0 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5",
  toggleInput: "peer sr-only",
};

function FieldShell({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={STYLES.field}>
      <label className={STYLES.label}>{label}</label>
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
}: {
  label: string;
  description?: string;
  name: string;
  defaultValue: string | null;
  channels: DiscordChannel[];
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} description={description}>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className={STYLES.select}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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
  label: string;
  description?: string;
  name: string;
  defaultValue: string | null;
  roles: DiscordRole[];
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} description={description}>
      <select
        name={name}
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
        key={defaultValue}
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
}: {
  label: string;
  description?: string;
  name: string;
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} description={description}>
      <textarea
        name={name}
        defaultValue={defaultValue}
        className={STYLES.textarea}
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
}: {
  label: string;
  description?: string;
  name: string;
  defaultValue: string | null;
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} description={description}>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ""}
        className={STYLES.input}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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
}: {
  label: string;
  description?: string;
  name: string;
  defaultChecked: boolean;
  onChange?: (value: boolean) => void;
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
        />
        <span className={STYLES.toggleTrack} />
        <span className={STYLES.toggleKnob} />
      </label>
    </div>
  );
}
