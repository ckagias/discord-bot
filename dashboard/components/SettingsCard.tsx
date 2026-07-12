const STYLES = {
  card: "rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] px-6 py-6 shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]",
  titleRow: "flex items-start justify-between gap-3",
  title: "text-base font-semibold text-[var(--text)]",
  description: "mt-1 text-sm text-[var(--text-muted)]",
  body: "mt-6 flex flex-col gap-6",
};

interface Props {
  title: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function SettingsCard({
  title,
  description,
  headerAction,
  children,
  className,
  bodyClassName,
}: Props) {
  return (
    <div className={className ?? STYLES.card}>
      {headerAction ? (
        <div className={STYLES.titleRow}>
          <div>
            <h2 className={STYLES.title}>{title}</h2>
            {description && <p className={STYLES.description}>{description}</p>}
          </div>
          {headerAction}
        </div>
      ) : (
        <>
          <h2 className={STYLES.title}>{title}</h2>
          {description && <p className={STYLES.description}>{description}</p>}
        </>
      )}
      <div className={bodyClassName ?? STYLES.body}>{children}</div>
    </div>
  );
}
