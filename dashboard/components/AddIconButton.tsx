export default function AddIconButton({
  onClick,
  label,
  className,
  iconClassName,
}: {
  onClick: () => void;
  label: string;
  className: string;
  iconClassName: string;
}) {
  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClassName}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>
  );
}
