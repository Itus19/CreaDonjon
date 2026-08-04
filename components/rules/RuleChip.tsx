import Link from "next/link";

/**
 * Renvoi vers une fiche de regle : meme forme que `EntityChip`, avec le
 * jeton de couleur semantique dedie aux regles (`--link-rule`, jamais
 * melange a `--link-entity`, specs/coquille-et-design.md §1). Le resume
 * (`ai_digest`) est porte en `title` : un survol suffit, pas de
 * dependance a une bulle custom pour ce ticket.
 */
export default function RuleChip({
  href,
  label,
  summary,
}: {
  href: string;
  label: string;
  summary?: string | null;
}) {
  return (
    <Link
      href={href}
      title={summary ?? undefined}
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-sm no-underline transition-colors hover:opacity-80"
      style={{ borderColor: "var(--link-rule)", color: "var(--link-rule)" }}
    >
      {label}
    </Link>
  );
}
