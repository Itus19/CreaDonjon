/**
 * Appels réseau du bandeau « Choisir à nouveau » (V3.1-119), sortis du composant :
 * aucun effet de montage ici (cliquet du câblage, docs/CABLAGE.md §6).
 */

/** Répond à un choix rouvert par un repos : `values` rechoisit, `null` garde l'ancienne réponse. Rend le message d'erreur du serveur, ou `null` si tout va bien. */
export async function repondreChoixRouvert(entityId: string, corps: { campaignId: string | null; key: string; values: string[] | null }): Promise<string | null> {
  const res = await fetch(`/api/entities/${entityId}/actions/refresh-choice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (res.ok) return null;
  const err = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof err?.error === "string" ? err.error : null;
}

/** Relit un bloc de l'entité (le choix écrit par le serveur a changé sa donnée et sa version). `null` : bloc absent. */
export async function relireBloc(entityId: string, blockId: string): Promise<{ id: string; data: unknown; version: number } | null> {
  const res = await fetch(`/api/entities/${entityId}/blocks`);
  if (!res.ok) throw new Error(`blocs : ${res.status}`);
  const blocs = (await res.json()) as { id: string; data: unknown; version: number }[];
  const bloc = blocs.find((b) => b.id === blockId);
  return bloc ? { id: bloc.id, data: bloc.data, version: bloc.version } : null;
}
