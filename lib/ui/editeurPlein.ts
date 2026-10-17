/**
 * Logique pure de l'éditeur plein écran (V3.1-31) : le composant
 * (`components/blocks/EditeurPleinEcran.tsx`) ne fait que brancher les gestes
 * sur ces fonctions, qui se testent sans DOM.
 *
 * Le brouillon est une liste de blocs DANS L'ORDRE D'AFFICHAGE ; l'ordre
 * enregistré (`displayOrder`) n'est recalculé qu'à l'envoi.
 */
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";

/** Un bloc tel que le brouillon le tient — même forme que `BlockItem`, sans en dépendre (la logique pure n'importe aucun composant). */
export interface BlocBrouillon {
  id: string;
  version: number;
  display: BlockDisplay;
  data: unknown;
  visibilityLevel: string;
  visibilityScopeId: string | null;
  displayOrder: number;
}

/** L'identité de la fiche, telle que l'en-tête de `EditEntityForm` l'écrit. */
export interface IdentiteBrouillon {
  name: string;
  entityKind: string;
  aliases: readonly string[];
  isPublic: boolean;
  /** PJ ou PNJ : sans effet quand `entityKind` n'est pas `character`. */
  isPc: boolean;
}

/** Un changement, au format du corps de `PATCH /api/entities/[id]/blocks`. */
export interface ChangementBloc {
  id: string;
  version: number;
  display: BlockDisplay;
  data: unknown;
  visibility: { level: string; scopeId: string | null };
  displayOrder: number;
}

/** Déplace l'élément `de` à l'index `vers` ; une copie, jamais la liste d'origine. Hors limites : rien ne bouge. */
export function deplacerVers<T>(liste: readonly T[], de: number, vers: number): T[] {
  const copie = [...liste];
  if (de < 0 || de >= copie.length || vers < 0 || vers >= copie.length || de === vers) return copie;
  const [element] = copie.splice(de, 1);
  copie.splice(vers, 0, element);
  return copie;
}

/** Monte (`-1`) ou descend (`1`) l'élément d'un cran ; aux extrémités, rien ne bouge. */
export function deplacer<T>(liste: readonly T[], index: number, sens: -1 | 1): T[] {
  return deplacerVers(liste, index, index + sens);
}

/** Indices (dans `valeurs`) de la plus longue suite strictement croissante — ces blocs n'ont pas à changer d'ordre. */
function indicesInchanges(valeurs: readonly number[]): Set<number> {
  const n = valeurs.length;
  const longueur: number[] = new Array(n).fill(1);
  const precedent: number[] = new Array(n).fill(-1);
  let meilleur = -1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (valeurs[j] < valeurs[i] && longueur[j] + 1 > longueur[i]) {
        longueur[i] = longueur[j] + 1;
        precedent[i] = j;
      }
    }
    if (meilleur === -1 || longueur[i] > longueur[meilleur]) meilleur = i;
  }
  const gardes = new Set<number>();
  for (let i = meilleur; i !== -1; i = precedent[i]) gardes.add(i);
  return gardes;
}

/**
 * Les `displayOrder` d'une liste déjà dans son nouvel ordre. Les blocs qui
 * forment déjà une suite croissante gardent leur ordre ; les autres se
 * répartissent à égale distance entre leurs voisins conservés — déplacer un
 * bloc ne réécrit donc que ce bloc (une ligne de moins à enregistrer, un
 * risque de conflit de moins).
 */
export function ordresApres(liste: readonly Pick<BlocBrouillon, "id" | "displayOrder">[]): Record<string, number> {
  const ordres: Record<string, number> = {};
  const gardes = indicesInchanges(liste.map((b) => b.displayOrder));
  let i = 0;
  while (i < liste.length) {
    if (gardes.has(i)) {
      ordres[liste[i].id] = liste[i].displayOrder;
      i++;
      continue;
    }
    // Série de blocs à replacer : de i à fin-1, entre deux voisins conservés.
    let fin = i;
    while (fin < liste.length && !gardes.has(fin)) fin++;
    const bas = i > 0 ? ordres[liste[i - 1].id] : null;
    const haut = fin < liste.length ? liste[fin].displayOrder : null;
    const nombre = fin - i;
    for (let k = 0; k < nombre; k++) {
      const rang = k + 1;
      let valeur: number;
      if (bas !== null && haut !== null) valeur = bas + ((haut - bas) * rang) / (nombre + 1);
      else if (bas !== null) valeur = bas + 1000 * rang;
      else if (haut !== null) valeur = haut - 1000 * (nombre - k);
      else valeur = 1000 * rang;
      ordres[liste[i + k].id] = valeur;
    }
    i = fin;
  }
  return ordres;
}

/** Égalité profonde de données JSON, indifférente à l'ordre des clés d'un objet (celui des tableaux compte). */
function egal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((element, i) => egal(element, b[i]));
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const clesA = Object.keys(objA).filter((cle) => objA[cle] !== undefined);
  const clesB = Object.keys(objB).filter((cle) => objB[cle] !== undefined);
  return clesA.length === clesB.length && clesA.every((cle) => egal(objA[cle], objB[cle]));
}

function contenuEgal(a: BlocBrouillon, b: BlocBrouillon): boolean {
  return (
    egal(a.display, b.display) &&
    egal(a.data, b.data) &&
    a.visibilityLevel === b.visibilityLevel &&
    a.visibilityScopeId === b.visibilityScopeId
  );
}

/**
 * Les blocs à envoyer : seulement ceux dont le contenu (titre, données,
 * visibilité) OU l'ordre a changé, au format de la route, dans l'ordre du
 * brouillon. `brouillon` est dans l'ordre d'affichage ; la version envoyée est
 * celle du brouillon (une sous-écriture a pu la faire avancer).
 */
export function changementsAEnvoyer(
  initiaux: readonly BlocBrouillon[],
  brouillon: readonly BlocBrouillon[],
): ChangementBloc[] {
  const parId = new Map(initiaux.map((b) => [b.id, b]));
  const ordres = ordresApres(brouillon);
  const changements: ChangementBloc[] = [];
  for (const bloc of brouillon) {
    const depart = parId.get(bloc.id);
    const nouvelOrdre = ordres[bloc.id];
    if (depart && contenuEgal(depart, bloc) && depart.displayOrder === nouvelOrdre) continue;
    changements.push({
      id: bloc.id,
      version: bloc.version,
      display: bloc.display,
      data: bloc.data,
      visibility: { level: bloc.visibilityLevel, scopeId: bloc.visibilityScopeId },
      displayOrder: nouvelOrdre,
    });
  }
  return changements;
}

/** Vrai quand l'identité diffère (les alias gardent leur ordre). */
export function identiteChangee(initiale: IdentiteBrouillon, courante: IdentiteBrouillon): boolean {
  return !egal({ ...initiale, aliases: [...initiale.aliases] }, { ...courante, aliases: [...courante.aliases] });
}

/** « Annuler » demande confirmation seulement s'il y a quelque chose à perdre : un bloc, son ordre ou l'identité. */
export function aDesChangements(
  initiaux: readonly BlocBrouillon[],
  brouillon: readonly BlocBrouillon[],
  identiteInitiale: IdentiteBrouillon,
  identiteCourante: IdentiteBrouillon,
): boolean {
  return identiteChangee(identiteInitiale, identiteCourante) || changementsAEnvoyer(initiaux, brouillon).length > 0;
}

/** Types dont l'éditeur écrit lui-même (plusieurs routes, canevas) ou ne tient pas sur un brouillon : ils se modifient sur la fiche. */
const TYPES_NON_DEPLIABLES: readonly string[] = ["map", "character"];

export function estDepliable(blockType: string): boolean {
  return !TYPES_NON_DEPLIABLES.includes(blockType);
}

const LONGUEUR_RESUME = 70;

function texteDesSegments(data: unknown): string {
  const segments = (data as { segments?: unknown } | null)?.segments;
  if (!Array.isArray(segments)) return "";
  const morceaux: string[] = [];
  for (const segment of segments) {
    const contenu = (segment as { content?: unknown } | null)?.content;
    if (!Array.isArray(contenu)) continue;
    for (const noeud of contenu) {
      const n = noeud as { t?: unknown; v?: unknown; label?: unknown } | null;
      if (n?.t === "text" && typeof n.v === "string") morceaux.push(n.v);
      else if (n?.t === "ref" && typeof n.label === "string") morceaux.push(n.label);
    }
    if (morceaux.join(" ").length > LONGUEUR_RESUME) break;
  }
  return morceaux.join(" ").replace(/\s+/g, " ").trim();
}

function tronquer(texte: string): string {
  return texte.length > LONGUEUR_RESUME ? `${texte.slice(0, LONGUEUR_RESUME - 1).trimEnd()}…` : texte;
}

function compter(data: unknown, cle: string): number | null {
  const liste = (data as Record<string, unknown> | null)?.[cle];
  return Array.isArray(liste) ? liste.length : null;
}

/** Court résumé d'un bloc replié (une ligne) : le début du texte, ou un compte. Vide quand rien d'utile n'est à dire. */
export function resumeBloc(blockType: string, data: unknown): string {
  if (blockType === "text") return tronquer(texteDesSegments(data));
  const comptes: Record<string, [string, string, string]> = {
    infobox: ["entries", "ligne", "lignes"],
    custom_table: ["rows", "ligne", "lignes"],
    random_table: ["entries", "entrée", "entrées"],
    timeline: ["entries", "événement", "événements"],
    quest: ["objectives", "objectif", "objectifs"],
  };
  const regle = comptes[blockType];
  if (!regle) return "";
  const n = compter(data, regle[0]);
  if (n === null) return "";
  return `${n} ${n > 1 ? regle[2] : regle[1]}`;
}
