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

/** V3.1-132 : une ressource déclarée dans le ruleset actif, pour le menu « Ressource dépensée » de l'éditeur de briques. */
export interface RessourceDeclaree {
  key: string;
  label: string;
  entryKey: string;
}

/** Lue une seule fois, à l'ouverture de l'éditeur (docs/QUOTAS.md) ; `null` si le serveur refuse. */
export async function chargerRessourcesDeclarees(worldSlug: string): Promise<RessourceDeclaree[] | null> {
  const res = await fetch(`/api/worlds/${worldSlug}/rules/resources`);
  if (!res.ok) return null;
  const corps = (await res.json().catch(() => null)) as { resources?: RessourceDeclaree[] } | null;
  return Array.isArray(corps?.resources) ? corps.resources : null;
}

export type ResultatBriques = { ok: true } | { ok: false; message: string; sansVariante: boolean };

/** « Enregistrer » de l'éditeur de briques. `sansVariante` : le serveur a refusé (409) parce que la règle est officielle. */
export async function enregistrerBriques(worldSlug: string, corps: Record<string, unknown>): Promise<ResultatBriques> {
  const res = await fetch(`/api/worlds/${worldSlug}/rules/playable`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (res.ok) return { ok: true };
  const erreur = (await res.json().catch(() => null)) as { error?: unknown; reason?: unknown } | null;
  return {
    ok: false,
    sansVariante: res.status === 409 && erreur?.reason === "no_variant",
    message: typeof erreur?.error === "string" ? erreur.error : "Impossible d'enregistrer les briques.",
  };
}

/**
 * V3.1-181 — « Rendre jouable » une aptitude de sous-classe : crée (ou
 * retrouve) sa fiche à briques dans la variante active du monde et rend sa
 * clé. Deux appels, au clic seulement : la variante active, puis la création.
 */
export async function rendreAptitudeJouable(worldSlug: string, subclassKey: string, featureIndex: number): Promise<ResultatGeste<{ entryKey: string }>> {
  const variante = await fetch(`/api/worlds/${worldSlug}/ruleset`);
  if (!variante.ok) return { ok: false, message: await messageDuServeur(variante, "Variante active introuvable.") };
  const { current } = (await variante.json()) as { current: string | null };
  if (!current) return { ok: false, message: "Ce monde n'a pas de variante active." };
  const res = await fetch(`/api/rulesets/${current}/subclasses/${encodeURIComponent(subclassKey)}/features`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featureIndex }),
  });
  if (!res.ok) return { ok: false, message: await messageDuServeur(res, "Impossible de rendre cette aptitude jouable.") };
  const corps = (await res.json()) as { entryKey: string };
  return { ok: true, valeur: { entryKey: corps.entryKey } };
}
