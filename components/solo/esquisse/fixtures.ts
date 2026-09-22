/**
 * V3-D — Données factices de l'esquisse. **Jetable avec elle.**
 *
 * Aucune requête, aucune base : l'écran se juge sur sa densité et sa
 * disposition, pas sur la fraîcheur de ses chiffres.
 *
 * Deuxième version, après retour de l'auteur : fil compact, marqueurs de
 * source gardés, et surtout le **vrai déroulé d'un tour** — le joueur dit
 * ce qu'il veut, le moteur demande un jet, le joueur le fait avec ses
 * outils ou annonce son dé physique.
 */

export type Discovery = "connu" | "esquisse" | "mentionne";

export interface WikiEntry {
  id: string;
  name: string;
  group: string;
  discovery: Discovery;
  /** Le corps de la fiche, tel qu'il s'ouvre DANS la colonne de gauche. */
  body?: string[];
}

export const WIKI: WikiEntry[] = [
  {
    id: "port-valdor",
    name: "Port-Valdor",
    group: "Lieux",
    discovery: "connu",
    body: [
      "Ville portuaire de sept mille âmes, bâtie sur trois terrasses au-dessus de la baie.",
      "Le Quartier des Quais en occupe la terrasse basse : entrepôts, tavernes, et la moitié des rixes de la ville.",
    ],
  },
  {
    id: "ancre",
    name: "L'Ancre Rouillée",
    group: "Lieux",
    discovery: "connu",
    body: [
      "Auberge à deux niveaux, poutres basses, une âtre qui tire mal.",
      "Bram la tient depuis onze ans. Il loge quiconque paie d'avance et ne pose aucune question.",
      "Salle commune au rez-de-chaussée, quatre chambres à l'étage, une cave dont il ne parle pas.",
    ],
  },
  { id: "quais", name: "Les Quais", group: "Lieux", discovery: "connu", body: ["Six appontements, deux grues à bras."] },
  { id: "entrepot", name: "L'entrepôt fermé", group: "Lieux", discovery: "mentionne" },
  {
    id: "bram",
    name: "Bram le Tavernier",
    group: "Personnes",
    discovery: "connu",
    body: ["Tavernier de l'Ancre Rouillée. Cordial, prudent, bien renseigné.", "Attitude envers toi : cordial."],
  },
  { id: "elfe", name: "L'elfe taciturne", group: "Personnes", discovery: "esquisse", body: ["Apparue en jouant. Rien d'écrit pour l'instant."] },
  { id: "grelin", name: "Grelin", group: "Personnes", discovery: "connu", body: ["Docker. Te doit douze pièces d'argent."] },
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
  { id: "gob2", name: "Gobelin 2", attitude: "hostile", discovery: "connu", zone: "engaged" },
];

export type Source = "prepare" | "tire" | "narre";

export type FeedItem =
  | { id: string; kind: "narration"; text: string; source: Source }
  | { id: string; kind: "player"; text: string }
  /** La réponse du MJ à une question — n'avance pas le temps, et le dit. */
  | { id: string; kind: "mj"; text: string }
  /** Le moteur DEMANDE un jet. Il ne le lance pas : c'est le joueur qui le fait. */
  | { id: string; kind: "demande"; label: string; detail: string; repondu: boolean }
  | {
      id: string;
      kind: "roll";
      label: string;
      expression: string;
      total: number;
      dc: number | null;
      verdict: "success" | "fail" | null;
      trace: string[];
      /** « à la main » quand le joueur a annoncé son dé physique. */
      origine: "fiche" | "volet" | "a la main";
    }
  | { id: string; kind: "rule"; label: string; lines: string[] }
  | { id: string; kind: "world"; text: string; source: Source };

/**
 * Un fil volontairement DENSE, et qui suit le vrai déroulé : intention →
 * demande de jet → jet fait par le joueur → conséquences → prose. Les
 * trois façons de répondre à une demande y figurent au moins une fois.
 */
export const FEED: FeedItem[] = [
  {
    id: "1",
    kind: "narration",
    source: "prepare",
    text: "Tu pousses la porte. La salle sent la bière et le bois mouillé. Une demi-douzaine de dockers jouent aux dés près de l'âtre, sans lever les yeux.",
  },
  { id: "2", kind: "player", text: "je cherche qui tient le comptoir" },
  { id: "3", kind: "demande", label: "Perception", detail: "test de Sagesse · DD 12", repondu: true },
  {
    id: "4",
    kind: "roll",
    label: "Perception — test de Sagesse",
    expression: "1d20 + 3",
    total: 16,
    dc: 12,
    verdict: "success",
    trace: ["dé : 13", "Sagesse +1", "Maîtrise +2"],
    origine: "fiche",
  },
  {
    id: "5",
    kind: "narration",
    source: "narre",
    text: "Derrière le comptoir, une elfe taciturne essuie des chopes sans te regarder. Bram, lui, t'a vu entrer — il lève un sourcil et repose sa pinte.",
  },
  { id: "6", kind: "world", source: "tire", text: "L'elfe taciturne entre dans la scène" },
  { id: "7", kind: "player", text: "est-ce que je peux attaquer et me déplacer dans le même tour ?" },
  {
    id: "8",
    kind: "mj",
    text: "Oui. Un tour te donne une action, une action bonus et ton déplacement — tu peux fractionner le déplacement avant et après l'attaque.",
  },
  { id: "9", kind: "player", text: "j'attaque le gobelin qui bloque l'escalier" },
  { id: "10", kind: "demande", label: "Attaque", detail: "épée longue · Gobelin 2 · CA 12", repondu: true },
  {
    id: "11",
    kind: "roll",
    label: "Attaque — épée longue · Gobelin 2",
    expression: "annoncé à la main",
    total: 23,
    dc: 12,
    verdict: "success",
    trace: ["dé annoncé : 18", "Force +3", "Maîtrise +2"],
    origine: "a la main",
  },
  { id: "12", kind: "demande", label: "Dégâts", detail: "épée longue · 1d8 + 3", repondu: true },
  {
    id: "13",
    kind: "roll",
    label: "Dégâts — épée longue",
    expression: "1d8 + 3",
    total: 5,
    dc: null,
    verdict: null,
    trace: ["dé : 2", "Force +3"],
    origine: "volet",
  },
  { id: "14", kind: "rule", label: "Ce que le tour a changé", lines: ["Gobelin 2 : 7 → 2 PV (Dégâts : 5)", "Naivara — action : 1 → 0"] },
  {
    id: "15",
    kind: "narration",
    source: "narre",
    text: "La lame mord l'épaule du gobelin, qui recule en sifflant contre la rampe. Il tient encore debout, de justesse.",
  },
];

/** La demande en cours, celle à laquelle l'écran attend une réponse. */
export const DEMANDE_EN_COURS = {
  label: "Sauvegarde de Dextérité",
  detail: "DD 13 · le gobelin te pousse contre la rampe",
  modificateur: "+3",
};

export const FICHE = {
  name: "Naivara Amakiir",
  ligne: "Elfe · Roublarde 4 · Criminelle",
  hp: { current: 11, max: 17, temp: 0 },
  ac: 14,
  initiative: "+3",
  vitesse: "9 m",
  maitrise: "+2",
  abilities: [
    { key: "FOR", score: 10, mod: "+0", save: "+0" },
    { key: "DEX", score: 17, mod: "+3", save: "+5" },
    { key: "CON", score: 13, mod: "+1", save: "+1" },
    { key: "INT", score: 12, mod: "+1", save: "+3" },
    { key: "SAG", score: 12, mod: "+1", save: "+1" },
    { key: "CHA", score: 14, mod: "+2", save: "+2" },
  ],
  actions: [
    { nom: "Épée longue", attaque: "+5", degats: "1d8+3 tranchant" },
    { nom: "Dague", attaque: "+5", degats: "1d4+3 perforant" },
    { nom: "Arc court", attaque: "+5", degats: "1d6+3 perforant · 24/96 m" },
  ],
  competences: [
    { nom: "Discrétion", mod: "+7" },
    { nom: "Investigation", mod: "+3" },
    { nom: "Perception", mod: "+3" },
    { nom: "Escamotage", mod: "+7" },
  ],
  ressources: [
    { nom: "Attaque sournoise", valeur: "2d6" },
    { nom: "Inspiration", valeur: "✦" },
  ],
};

/** L'en-tête : ville, lieu, pièce à gauche ; date, heure, météo à droite. */
export const ENTETE = {
  ville: { nom: "Port-Valdor", wikiId: "port-valdor" },
  lieu: { nom: "L'Ancre Rouillée", wikiId: "ancre" },
  piece: "salle commune",
  date: "Mercredi 12 juillet",
  heure: "22:15",
  meteo: "Pluie",
  temperature: "14 °C",
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

export const ORIGINE_LABEL: Record<"fiche" | "volet" | "a la main", string> = {
  fiche: "depuis la fiche",
  volet: "volet de dés",
  "a la main": "annoncé à la main",
};

// --- Ajouts de la troisième passe -----------------------------------------

export interface Quete {
  id: string;
  titre: string;
  donneur: string;
  objectifs: { id: string; text: string; done: boolean }[];
  /** Ce que la quête promet — texte libre, comme dans le bloc `quest`. */
  recompense?: string;
}

/** Même forme que le bloc `quest` (V2-H4) : des objectifs cochés ou non, rien de plus. */
export const QUETES: Quete[] = [
  {
    id: "collier",
    titre: "Le collier des Ventdescartes",
    donneur: "Lyra Ventdescartes",
    recompense: "150 pa et une dette de la maison Ventdescartes",
    objectifs: [
      { id: "o1", text: "Retrouver la trace du receleur", done: true },
      { id: "o2", text: "Entrer dans l'entrepôt fermé", done: false },
      { id: "o3", text: "Rapporter le collier à Lyra", done: false },
    ],
  },
  {
    id: "dette",
    titre: "La dette de Grelin",
    donneur: "toi-même",
    objectifs: [
      { id: "o1", text: "Retrouver Grelin à l'Ancre", done: true },
      { id: "o2", text: "Récupérer les douze pièces d'argent", done: false },
    ],
  },
];

export interface Objet {
  id: string;
  nom: string;
  detail: string;
  equipe: boolean;
}

export const INVENTAIRE: Objet[] = [
  { id: "epee", nom: "Épée longue", detail: "1d8 tranchant · 1,5 kg", equipe: true },
  { id: "dague", nom: "Dague", detail: "1d4 perforant · finesse · 0,5 kg", equipe: true },
  { id: "cuir", nom: "Armure de cuir clouté", detail: "CA 12 + Dex · 6,5 kg", equipe: true },
  { id: "arc", nom: "Arc court", detail: "1d6 perforant · 24/96 m · 1 kg", equipe: false },
  { id: "corde", nom: "Corde de chanvre (15 m)", detail: "4,5 kg", equipe: false },
  { id: "outils", nom: "Outils de voleur", detail: "0,5 kg", equipe: false },
];

export interface Sort {
  id: string;
  nom: string;
  niveau: number;
  ecole: string;
  prepare: boolean;
}

export const SORTS: Sort[] = [
  { id: "prestidigitation", nom: "Prestidigitation", niveau: 0, ecole: "Transmutation", prepare: true },
  { id: "main", nom: "Main du mage", niveau: 0, ecole: "Invocation", prepare: true },
  { id: "charme", nom: "Charme-personne", niveau: 1, ecole: "Enchantement", prepare: true },
  { id: "deguisement", nom: "Déguisement", niveau: 1, ecole: "Illusion", prepare: false },
  { id: "image", nom: "Image silencieuse", niveau: 1, ecole: "Illusion", prepare: false },
];

export const EMPLACEMENTS = [
  { niveau: 1, total: 4, utilises: 2 },
  { niveau: 2, total: 2, utilises: 0 },
];

/**
 * Des dés factices, tirés d'une liste FIXE.
 *
 * Jamais `Math.random()`, même dans une esquisse : dans ce projet le
 * client ne lance pas les dés (CLAUDE.md, règle 8), et une esquisse qui
 * prendrait cette habitude la donnerait au vrai écran. Une liste fixe a
 * en prime le mérite d'être reproductible, et d'éviter un écart entre le
 * rendu serveur et le rendu client.
 */
export const DES_FACTICES = [17, 4, 12, 20, 8, 15, 1, 11, 19, 6];
