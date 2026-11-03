/**
 * V3.1-94 — appels réseau de l'écran d'une règle, sortis du composant : aucun
 * effet de montage ici (cliquet du câblage, docs/CABLAGE.md §6). Chaque
 * fonction rend le message d'erreur du serveur (`error`) ou un texte de repli.
 */

export type ResultatGeste<T> = { ok: true; valeur: T } | { ok: false; message: string };

async function messageDuServeur(res: Response, repli: string): Promise<string> {
  const corps = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof corps?.error === "string" ? corps.error : repli;
}

/** « Créer une version maison » : copie la règle officielle dans la variante active. */
export async function creerVersionMaison(worldSlug: string, entryKey: string): Promise<ResultatGeste<null>> {
  const res = await fetch(`/api/worlds/${worldSlug}/rules/house-version`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryKey }),
  });
  if (res.ok) return { ok: true, valeur: null };
  return { ok: false, message: await messageDuServeur(res, "Impossible de créer la version maison.") };
}

/** « Épingler au Bloc-notes » ; `alreadyPinned` si la règle y était déjà. */
export async function epinglerRegle(worldSlug: string, key: string): Promise<ResultatGeste<{ alreadyPinned: boolean }>> {
  const res = await fetch(`/api/worlds/${worldSlug}/notes/pin-rule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) return { ok: false, message: await messageDuServeur(res, "Impossible d'épingler cette règle.") };
  const corps = (await res.json().catch(() => null)) as { alreadyPinned?: unknown } | null;
  return { ok: true, valeur: { alreadyPinned: corps?.alreadyPinned === true } };
}
