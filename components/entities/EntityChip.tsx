import Link from "next/link";

/**
 * Renvoi vers une fiche de wiki : violet doux, jamais melange aux deux
 * autres couleurs semantiques (specs/coquille-et-design.md §1).
 */
export default function EntityChip({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-sm no-underline transition-colors hover:opacity-80"
      style={{ borderColor: "var(--link-entity)", color: "var(--link-entity)" }}
    >
      {label}
    </Link>
  );
}
