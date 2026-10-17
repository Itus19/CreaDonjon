/**
 * Clavier des onglets (ADR 0026) : renvoie l'index de l'onglet à activer
 * pour une touche donnée, ou `null` si la touche n'est pas une navigation.
 * Fonction pure, sortie de `Tabs.tsx` pour être testable sans navigateur.
 */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
