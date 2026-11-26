/**
 * AG-5 — un sort déjà obtenu par une autre source ne se choisit pas deux fois
 * (règle 2024 : on en prend un autre). L'assistant de création le grise, avec
 * la source qui l'a donné : « déjà pris par Initié à la magie ».
 *
 * Deux origines : les sorts qu'une aptitude accorde (`sheet.grantedSpells`,
 * dont ceux choisis par un don ou une sous-classe, sous la clé
 * `choice:<clé du choix>`), et les sorts choisis à l'étape Sorts de la classe
 * (`spellcasting.known`).
 */

interface SortAccorde {
  key: string;
  featureKey: string;
  label: string;
}

type SortConnu = { ref: { kind: "rule"; key: string } | { kind: string } };

export function sortsDejaPris(params: {
  accordes: readonly SortAccorde[];
  connus: readonly SortConnu[];
  /** Le nom de la classe (ou des classes) de l'étape Sorts. */
  sourceClasse: string;
  /** La clé du choix affiché ; absente à l'étape Sorts de la classe. */
  choix?: string;
}): Map<string, string> {
  const pris = new Map<string, string>();
  for (const s of params.accordes) {
    if (params.choix !== undefined && s.featureKey === `choice:${params.choix}`) continue;
    if (!pris.has(s.key)) pris.set(s.key, s.label);
  }
  // À l'étape Sorts, les sorts de classe sont ceux qu'on est en train de choisir.
  if (params.choix !== undefined) {
    for (const k of params.connus) {
      if (k.ref.kind === "rule" && "key" in k.ref && !pris.has(k.ref.key)) pris.set(k.ref.key, params.sourceClasse);
    }
  }
  return pris;
}
