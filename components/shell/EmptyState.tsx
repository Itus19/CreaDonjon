/**
 * Un ecran vide est une invitation a agir, pas un message d'erreur
 * (specs/coquille-et-design.md §5, critere V0-03b).
 */
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge px-6 py-12 text-center">
      <p className="font-chrome text-base font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
