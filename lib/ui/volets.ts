/**
 * Les fenêtres du MJ en deux volets à onglets (V3.1-20, ADR 0066). Logique
 * pure : où va une fiche qu'on ouvre, ce que devient un volet qu'on vide,
 * un onglet qu'on glisse, et comment l'adresse retient la disposition.
 *
 * Une fiche est désignée par son identifiant de fenêtre (`refId` de
 * `components/shell/windowRefs.ts`, « entite:slug », « outil:notes »…).
 * Les fiches ouvertes, elles, restent dans `?avec=` et le chemin (ADR 0006,
 * 0011) : ce module ne décide que de leur place.
 */

export interface Volet {
  /** Les fiches du volet, dans l'ordre de leurs onglets. Jamais vide. */
  onglets: string[];
  /** L'onglet affiché. */
  actif: string;
}

export interface Disposition {
  /** Zéro, un ou deux volets ; le premier à gauche. */
  volets: Volet[];
  /** Le volet actif : le dernier cliqué, celui qui reçoit la prochaine fiche. */
  voletActif: number;
  /** Largeur du volet de gauche, en pour cent de la zone, quand il y en a deux. */
  partage: number;
}

export const PARTAGE_MIN = 20;
export const PARTAGE_MAX = 80;
export const PARTAGE_DEFAUT = 50;

export function voletDe(d: Disposition, id: string): number {
  return d.volets.findIndex((v) => v.onglets.includes(id));
}

/** Rend l'onglet `id` actif, et son volet actif. */
export function activer(d: Disposition, id: string): Disposition {
  const i = voletDe(d, id);
  if (i < 0) return d;
  return { ...d, volets: d.volets.map((v, j) => (j === i ? { ...v, actif: id } : v)), voletActif: i };
}

/**
 * Une fiche qu'on ouvre : la première prend toute la zone, la deuxième ouvre
 * le second volet, les suivantes s'ajoutent en onglet au volet actif. Une
 * fiche déjà placée ne bouge pas : elle redevient l'onglet actif.
 */
export function placer(d: Disposition, id: string): Disposition {
  if (voletDe(d, id) >= 0) return activer(d, id);
  if (d.volets.length === 0) return { ...d, volets: [{ onglets: [id], actif: id }], voletActif: 0 };
  if (d.volets.length === 1) return { ...d, volets: [...d.volets, { onglets: [id], actif: id }], voletActif: 1 };
  return {
    ...d,
    volets: d.volets.map((v, j) => (j === d.voletActif ? { onglets: [...v.onglets, id], actif: id } : v)),
  };
}

/** Le volet sans `id` ; l'onglet actif passe à son voisin de gauche, sinon de droite. `null` si le volet se vide. */
function sansOnglet(v: Volet, id: string): Volet | null {
  const index = v.onglets.indexOf(id);
  const onglets = v.onglets.filter((o) => o !== id);
  if (onglets.length === 0) return null;
  const actif = v.actif === id ? (onglets[index - 1] ?? onglets[index] ?? onglets[0]) : v.actif;
  return { onglets, actif };
}

/** Retire le volet `i` vidé, et garde l'index du volet actif sur le même volet. */
function sansVolet(d: Disposition, i: number, voletActif: number): Disposition {
  const volets = d.volets.filter((_, j) => j !== i);
  const actif = voletActif > i ? voletActif - 1 : voletActif === i ? 0 : voletActif;
  return { ...d, volets, voletActif: Math.max(0, Math.min(actif, volets.length - 1)) };
}

/** Une fiche fermée. Un volet vidé disparaît ; l'autre reprend toute la place. */
export function retirer(d: Disposition, id: string): Disposition {
  const i = voletDe(d, id);
  if (i < 0) return d;
  const reste = sansOnglet(d.volets[i], id);
  if (reste === null) return sansVolet(d, i, d.voletActif);
  return { ...d, volets: d.volets.map((v, j) => (j === i ? reste : v)) };
}

/**
 * Un onglet glissé vers le volet `vers` (0 : gauche, 1 : droite). Vers
 * l'autre volet, il y passe ; vers la droite quand il n'y a qu'un volet, il
 * crée le second — sauf s'il est seul : un volet ne se coupe pas en deux.
 */
export function deplacer(d: Disposition, id: string, vers: 0 | 1): Disposition {
  const i = voletDe(d, id);
  if (i < 0 || i === vers) return d;
  if (d.volets.length === 1) {
    if (vers === 0) return d;
    const reste = sansOnglet(d.volets[0], id);
    if (reste === null) return d;
    return { ...d, volets: [reste, { onglets: [id], actif: id }], voletActif: 1 };
  }
  const reste = sansOnglet(d.volets[i], id);
  const cible = d.volets[vers];
  const volets = d.volets.map((v, j) => (j === vers ? { onglets: [...cible.onglets, id], actif: id } : j === i ? (reste ?? v) : v));
  const avant: Disposition = { ...d, volets, voletActif: vers };
  return reste === null ? sansVolet(avant, i, vers) : avant;
}

/** Position du séparateur, bornée pour qu'aucun volet ne disparaisse. */
export function fixerPartage(d: Disposition, pourcent: number): Disposition {
  const borne = Math.min(PARTAGE_MAX, Math.max(PARTAGE_MIN, Number.isFinite(pourcent) ? pourcent : PARTAGE_DEFAUT));
  return { ...d, partage: Math.round(borne) };
}

// ---- adresse : `?volets=` ----------------------------------------------
//
// « gauche~droite~actif gauche~actif droite~volet actif~partage », les
// fiches séparées par des virgules. Un identifiant de fenêtre ne contient
// ni « ~ » ni « , » (préfixe et slug).

const SEP = "~";

export function ecrireDisposition(d: Disposition): string | null {
  if (d.volets.length === 0) return null;
  const [g, dr] = d.volets;
  return [g.onglets.join(","), dr?.onglets.join(",") ?? "", g.actif, dr?.actif ?? "", String(d.voletActif), String(d.partage)].join(SEP);
}

/**
 * La disposition des fiches `ids` (ouvertes, dans leur ordre d'ouverture),
 * d'après l'adresse. Une fiche de l'adresse qui n'est plus ouverte est
 * oubliée ; une fiche ouverte que l'adresse ne cite pas est placée selon la
 * règle de `placer`. Une adresse absente ou abîmée ne lève jamais d'erreur :
 * les fiches se placent alors dans l'ordre.
 */
export function lireDisposition(param: string | null, ids: readonly string[]): Disposition {
  const ouvertes = new Set(ids);
  const morceaux = (param ?? "").split(SEP);
  const liste = (texte: string | undefined) => (texte ?? "").split(",").filter((id) => id.length > 0);
  const gauche = [...new Set(liste(morceaux[0]))].filter((id) => ouvertes.has(id));
  const droite = [...new Set(liste(morceaux[1]))].filter((id) => ouvertes.has(id) && !gauche.includes(id));
  const lus: { onglets: string[]; actif: string | undefined; index: number }[] = [
    { onglets: gauche, actif: morceaux[2], index: 0 },
    { onglets: droite, actif: morceaux[3], index: 1 },
  ].filter((v) => v.onglets.length > 0);

  const voletActifLu = Number(morceaux[4]);
  const indexActif = lus.findIndex((v) => v.index === voletActifLu);
  let d: Disposition = {
    volets: lus.map((v) => ({ onglets: v.onglets, actif: v.actif && v.onglets.includes(v.actif) ? v.actif : v.onglets[v.onglets.length - 1] })),
    voletActif: Math.max(0, indexActif),
    partage: PARTAGE_DEFAUT,
  };
  d = fixerPartage(d, morceaux[5] === undefined || morceaux[5] === "" ? PARTAGE_DEFAUT : Number(morceaux[5]));

  const places = new Set([...gauche, ...droite]);
  for (const id of ids) if (!places.has(id)) d = placer(d, id);
  return d;
}
