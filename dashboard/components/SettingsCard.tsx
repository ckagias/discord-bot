const STYLES = {
  card: "rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6",
  title: "text-base font-semibold text-[var(--text)]",
  description: "mt-1 text-sm text-[var(--text-muted)]",
  body: "mt-6 flex flex-col gap-6",
};

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function SettingsCard({ title, description, children }: Props) {
  return (
    <div className={STYLES.card}>
      <h2 className={STYLES.title}>{title}</h2>
      {description && <p className={STYLES.description}>{description}</p>}
      <div className={STYLES.body}>{children}</div>
    </div>
  );
}
