/**
 * ADR 0078 (V3.1-183) — appel réseau du bouton « Regagner » d'une ressource,
 * sorti du composant : aucun effet de montage ici (docs/CABLAGE.md §6). Une
 * intention seulement ; le serveur vérifie le coût et l'écrit.
 */
export async function regagnerRessource(entityId: string, corps: { campaignId: string | null; resourceKey: string }): Promise<string | null> {
  const res = await fetch(`/api/entities/${entityId}/actions/resource-regain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (res.ok) return null;
  const err = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof err?.error === "string" ? err.error : "Regain impossible.";
}
