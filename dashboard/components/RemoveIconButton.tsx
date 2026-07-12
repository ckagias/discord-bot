export default function RemoveIconButton({
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
    <button type="button" onClick={onClick} className={className} aria-label={label} title="Remove">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClassName}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}
