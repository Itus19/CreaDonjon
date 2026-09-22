/**
 * V3-D — Données factices de l'esquisse. **Jetable avec elle.**
 *
 * Aucune requête, aucune base : l'écran se juge sur sa densité et sa
 * disposition, pas sur la fraîcheur de ses chiffres. Le backlog le dit —
 * « l'écran se construit contre des données factices sans rien attendre ;
 * c'est même souhaitable, parce que voir l'écran change la conception du
 * reste ».
 *
 * Le contenu reprend la scène du dessin de la section « Le dessin » et du
 * spike S1 (l'Ancre Rouillée, Bram, une elfe taciturne) pour qu'on compare
 * ce qu'on voit à ce qui était prévu.
 */

export type Discovery = "connu" | "esquisse" | "mentionne";

export interface WikiEntry {
  id: string;
  name: string;
  group: string;
  discovery: Discovery;
  /** La fiche ouverte dans la colonne, s'il y en a une. */
  current?: boolean;
}

export const WIKI: WikiEntry[] = [
  { id: "ancre", name: "L'Ancre Rouillée", group: "Lieux", discovery: "connu", current: true },
  { id: "quais", name: "Les Quais", group: "Lieux", discovery: "connu" },
  { id: "entrepot", name: "L'entrepôt fermé", group: "Lieux", discovery: "mentionne" },
  { id: "bram", name: "Bram le Tavernier", group: "Personnes", discovery: "connu" },
  { id: "elfe", name: "L'elfe taciturne", group: "Personnes", discovery: "esquisse" },
  { id: "grelin", name: "Grelin", group: "Personnes", discovery: "connu" },
  { id: "main", name: "La Main de Sel", group: "Factions", discovery: "mentionne" },
];

export interface Present {
  id: string;
  name: string;
  attitude: string;
  discovery: Discovery;
  zone: "engaged" | "near" | "far";
}

export const PRESENTS: Present[] = [
  { id: "bram", name: "Bram", attitude: "cordial", discovery: "connu", zone: "near" },
  { id: "elfe", name: "L'elfe taciturne", attitude: "neutre", discovery: "esquisse", zone: "far" },
];

export type Source = "prepare" | "tire" | "narre";

export type FeedItem =
  | { id: string; kind: "narration"; text: string; source: Source }
  | { id: string; kind: "player"; text: string }
  | {
      id: string;
      kind: "roll";
      label: string;
      expression: string;
      total: number;
      dc: number | null;
      verdict: "success" | "fail" | null;
      trace: string[];
    }
  | { id: string; kind: "rule"; label: string; lines: string[] }
  | { id: string; kind: "world"; text: string; source: Source };

/**
 * Un fil volontairement DENSE : deux tours complets, chacun avec son jet,
 * son application de règle et sa prose. C'est le cas qui sature, donc le
 * seul qui vaille d'être regardé — un fil de trois lignes est joli partout.
 */
export const FEED: FeedItem[] = [
  {
    id: "1",
    kind: "narration",
    source: "prepare",
    text: "Tu pousses la porte. La salle sent la bière et le bois mouillé. Une demi-douzaine de dockers jouent aux dés près de l'âtre, sans lever les yeux.",
  },
  { id: "2", kind: "player", text: "je cherche qui tient le comptoir" },
  {
    id: "3",
    kind: "roll",
    label: "Perception — test de Sagesse",
    expression: "1d20 + 3",
    total: 16,
    dc: 12,
    verdict: "success",
    trace: ["dé : 13", "Sagesse +1", "Maîtrise +2"],
  },
  {
    id: "4",
    kind: "narration",
    source: "narre",
    text: "Derrière le comptoir, une elfe taciturne essuie des chopes sans te regarder. Bram, lui, t'a vu entrer — il lève un sourcil et repose sa pinte.",
  },
  { id: "5", kind: "world", source: "tire", text: "L'elfe taciturne entre dans la scène" },
  { id: "6", kind: "player", text: "je frappe le gobelin qui bloque l'escalier" },
  {
    id: "7",
    kind: "roll",
    label: "Attaque — épée longue · Gobelin 2",
    expression: "1d20 + 5",
    total: 23,
    dc: 12,
    verdict: "success",
    trace: ["dé : 18", "Force +3", "Maîtrise +2"],
  },
  {
    id: "8",
    kind: "rule",
    label: "Ce que le tour a changé",
    lines: ["Gobelin 2 : 7 → 2 PV (Dégâts : 5)", "Naivara — action : 1 → 0"],
  },
  {
    id: "9",
    kind: "narration",
    source: "narre",
    text: "La lame mord l'épaule du gobelin, qui recule en sifflant contre la rampe. Il tient encore debout, de justesse.",
  },
];

export const FICHE = {
  name: "Naivara",
  hp: { current: 11, max: 17 },
  ac: 14,
  initiative: "+3",
  slots: { used: 2, total: 4 },
  inspiration: true,
};

export const MONDE = {
  date: "Jour 14 · Ches",
  lune: "Lune croissante",
  bourse: "47 pa",
  quete: "Retrouver le collier des Ventdescartes",
};

export const ENTETE = {
  lieu: "L'Ancre Rouillée",
  quartier: "Quartier des Quais",
  meteo: "Pluie",
  moment: "Nuit",
  heure: "23h10",
};

export const DISCOVERY_MARK: Record<Discovery, { mark: string; title: string }> = {
  connu: { mark: "◆", title: "connu — la fiche est écrite" },
  esquisse: { mark: "○", title: "esquisse — apparu en jouant, pas encore ancré" },
  mentionne: { mark: "◇", title: "mentionné — on en a parlé, rien de plus" },
};

export const SOURCE_MARK: Record<Source, { mark: string; title: string }> = {
  prepare: { mark: "▪", title: "préparé — écrit avant la partie" },
  tire: { mark: "⬦", title: "tiré — sorti d'un générateur, dés réels" },
  narre: { mark: "~", title: "narré — habillé par le modèle, aucun fait inventé" },
};
