/** Partagé entre `PlayableCharacterSheet.tsx` (choix de compétences) et `TraitsTab.tsx` (choix de langues) — V2-G5, extrait dans son propre fichier pour éviter un import circulaire entre les deux. */
export function toggleChoice(current: string[], option: string, max: number): string[] {
  if (current.includes(option)) return current.filter((o) => o !== option);
  if (current.length >= max) return current;
  return [...current, option];
}
