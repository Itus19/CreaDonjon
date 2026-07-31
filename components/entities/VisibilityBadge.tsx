/**
 * Le signe distinctif du produit (specs/coquille-et-design.md §1) : un
 * liseré terracotta constant sur tout contenu reserve au MJ, pour repondre
 * d'un coup d'oeil a « est-ce que je peux montrer cet ecran a ma table ? ».
 * Couleur sematique fixe (--gm), jamais melangee aux deux autres (entite,
 * regle).
 */
export default function VisibilityBadge({ level }: { level: string }) {
  if (level !== "gm" && level !== "private") return null;

  const label = level === "gm" ? "MJ uniquement" : "Privé";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: "var(--gm)", color: "var(--gm)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--gm)" }} />
      {label}
    </span>
  );
}
