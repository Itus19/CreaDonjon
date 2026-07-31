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
