/**
 * campaign/user necessitent un scopeId (une campagne ou un utilisateur
 * precis) : pas de selecteur pour ca encore, donc pas propose ici (meme
 * simplification que components/entities/SegmentsEditor.tsx).
 */
export const VISIBILITY_OPTIONS: { value: "public" | "players" | "gm" | "private"; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "players", label: "Joueurs" },
  { value: "gm", label: "MJ uniquement" },
  { value: "private", label: "Privé" },
];

/**
 * V3.1-63 — la pastille de visibilité en couleur : vert Public, bleu Joueurs,
 * orange MJ, gris Privé (jetons `success`, `players`, `gm`, `ink-muted`).
 * Les classes sont écrites en entier pour que Tailwind les voie ; « campagne »
 * et « utilisateur » restent en gris avec leur propre libellé.
 */
export const VISIBILITY_PILL_STYLES: Record<string, { pill: string; dot: string }> = {
  public: { pill: "border-success/45 text-success", dot: "bg-success" },
  players: { pill: "border-players/50 text-players", dot: "bg-players" },
  gm: { pill: "border-gm/55 text-gm", dot: "bg-gm" },
  private: { pill: "border-edge text-ink-muted", dot: "bg-ink-muted" },
};

export const VISIBILITY_PILL_FALLBACK = { pill: "border-edge text-ink-muted", dot: "bg-ink-muted" };

/** Niveaux pour lesquels `messages/` a un libellé et une phrase « qui la voit » (clés de `fiche.niveaux` / `fiche.qui`). */
export const VISIBILITY_LEVEL_KEYS = ["public", "players", "gm", "private", "campaign", "user"] as const;
export type VisibilityLevelKey = (typeof VISIBILITY_LEVEL_KEYS)[number];

export function isVisibilityLevelKey(level: string): level is VisibilityLevelKey {
  return (VISIBILITY_LEVEL_KEYS as readonly string[]).includes(level);
}
