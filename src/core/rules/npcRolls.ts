/**
 * ADR 0121, V3.2-73 — Les attaques d'un PNJ à fiche allégée (bloc `statblock`,
 * ADR 0118), lues dans le texte de ses actions tel que le SRD 2024 l'écrit :
 * « Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Slashing damage. »
 *
 * Le bonus d'attaque et les dés viennent de la fiche, jamais de l'IA
 * (règle 8). Les dés se lancent côté serveur ; ici, seulement la lecture.
 * Une action qui n'est pas un jet d'attaque (Attaques multiples, une
 * sauvegarde) ne donne rien : le tour du PNJ ne la propose pas encore.
 *
 * Les jets de compétence et de sauvegarde des PNJ (V3.2-52) sont en fin de
 * fichier.
 */

import { SKILL_ABILITIES, type Ability, type Skill } from "./abilities";

export interface NpcDamage {
  /** 0 avec `faces` 0 : des dégâts fixes (« Hit: 1 Bludgeoning damage »). */
  count: number;
  faces: number;
  bonus: number;
  /** En minuscules, en anglais comme dans le SRD : `slashing`, `piercing`… */
  type: string;
}

export interface NpcAttack {
  name: string;
  melee: boolean;
  ranged: boolean;
  attackBonus: number;
  damage: NpcDamage[];
}

const JET = /(Melee or Ranged|Melee|Ranged) Attack Roll:\s*([+\-−]\s*\d+)/i;
const DES = /\((\d+)d(\d+)(?:\s*([+\-−])\s*(\d+))?\)\s*([A-Za-z]+) damage/gi;
const FIXES = /Hit:\s*(\d+)\s+([A-Za-z]+) damage/i;

const entier = (s: string): number => Number(s.replace(/\s/g, "").replace("−", "-"));

export function npcAttackFromAction(action: { name: string; text: string }): NpcAttack | null {
  const jet = JET.exec(action.text);
  if (!jet) return null;
  const portee = jet[1]!.toLowerCase();
  const damage: NpcDamage[] = [];
  for (const m of action.text.matchAll(DES)) {
    const signe = m[3] === "-" || m[3] === "−" ? -1 : 1;
    damage.push({ count: Number(m[1]), faces: Number(m[2]), bonus: m[4] ? signe * Number(m[4]) : 0, type: m[5]!.toLowerCase() });
  }
  if (damage.length === 0) {
    const fixes = FIXES.exec(action.text);
    if (fixes) damage.push({ count: 0, faces: 0, bonus: Number(fixes[1]), type: fixes[2]!.toLowerCase() });
  }
  return {
    name: action.name,
    melee: portee !== "ranged",
    ranged: portee !== "melee",
    attackBonus: entier(jet[2]!),
    damage,
  };
}

export function npcAttacks(actions: readonly { name: string; text: string }[]): NpcAttack[] {
  return actions.map(npcAttackFromAction).filter((a): a is NpcAttack => a !== null);
}

/** Les types de dégâts du SRD en mots, pour le fait que lit le récit. */
export const DAMAGE_TYPE_LABELS_FR: Record<string, string> = {
  slashing: "tranchants",
  piercing: "perforants",
  bludgeoning: "contondants",
  poison: "de poison",
  fire: "de feu",
  cold: "de froid",
  lightning: "de foudre",
  acid: "d'acide",
  necrotic: "nécrotiques",
  radiant: "radiants",
  psychic: "psychiques",
  thunder: "de tonnerre",
  force: "de force",
};

/**
 * ADR 0121, point 5 — La tactique fixe du tour d'un PNJ : frapper un ennemi
 * qu'il peut atteindre, la personne qui joue d'abord (c'est l'histoire qu'on
 * raconte), avec l'attaque qui fait le plus de dégâts en moyenne. Au contact
 * ou proche (≤ 9 m, un déplacement), le corps à corps ; loin, à distance ;
 * loin sans arme à distance, il s'approche ; sans attaque, il esquive.
 * Le choix par l'IA dans une liste fermée viendra par-dessus (V3.2-73, suite).
 */
export type ZoneCombat = "engaged" | "near" | "far";

export type ActionPnj =
  | { kind: "attack"; attack: NpcAttack; targetId: string; /** Il s'est rapproché pour frapper au corps à corps. */ approche: boolean }
  | { kind: "approach" }
  | { kind: "dodge" };

export function moyenneDegats(attack: NpcAttack): number {
  return attack.damage.reduce((s, d) => s + (d.count * (d.faces + 1)) / 2 + d.bonus, 0);
}

export function tactiqueDuPnj(params: {
  zone: ZoneCombat;
  attaques: readonly NpcAttack[];
  /** Les ennemis encore debout ; `joueur` : la personne qui joue. */
  ennemis: readonly { id: string; joueur: boolean }[];
}): ActionPnj {
  if (params.ennemis.length === 0) return { kind: "dodge" };
  const cible = (params.ennemis.find((e) => e.joueur) ?? params.ennemis[0]!).id;
  const meilleure = (lot: NpcAttack[]) => [...lot].sort((a, b) => moyenneDegats(b) - moyenneDegats(a))[0];
  const melee = meilleure(params.attaques.filter((a) => a.melee));
  const distance = meilleure(params.attaques.filter((a) => a.ranged));
  if (params.zone !== "far" && melee) return { kind: "attack", attack: melee, targetId: cible, approche: params.zone === "near" };
  if (distance) return { kind: "attack", attack: distance, targetId: cible, approche: false };
  if (melee) return { kind: "approach" };
  return { kind: "dodge" };
}

export interface AttaquePnjResolue {
  naturel: number;
  total: number;
  /** `null` : CA inconnue, pas de verdict (on ne l'invente pas). */
  touche: boolean | null;
  critique: boolean;
  degats: number;
  /** Le détail des dés, pour le journal : « 1d6+1 (4) ». */
  detail: string;
}

/**
 * Le jet d'attaque d'un PNJ et ses dégâts, règles 2024 : un 20 naturel touche
 * et double les dés, un 1 naturel rate, quelle que soit la CA. Les dés
 * viennent de `rng` (serveur : `serverRng`) ; les dégâts ne sont jamais négatifs.
 */
export function resoudreAttaquePnj(attack: NpcAttack, ac: number | null, rng: { nextInt(max: number): number }): AttaquePnjResolue {
  const naturel = rng.nextInt(20) + 1;
  const total = naturel + attack.attackBonus;
  const critique = naturel === 20;
  const touche = naturel === 20 ? true : naturel === 1 ? false : ac === null ? null : total >= ac;
  let degats = 0;
  const morceaux: string[] = [];
  if (touche === true) {
    for (const d of attack.damage) {
      const nombre = d.count * (critique ? 2 : 1);
      let somme = 0;
      for (let i = 0; i < nombre; i++) somme += rng.nextInt(d.faces) + 1;
      degats += somme + d.bonus;
      morceaux.push(nombre > 0 ? `${nombre}d${d.faces}${d.bonus ? (d.bonus > 0 ? `+${d.bonus}` : d.bonus) : ""} (${somme + d.bonus})` : `${d.bonus}`);
    }
  }
  return { naturel, total, touche, critique, degats: Math.max(0, degats), detail: morceaux.join(" + ") };
}

/**
 * V3.2-52 — Les actions qu'un PNJ peut tenter hors attaque, en liste fermée :
 * la narration en choisit une (et un palier de difficulté), jamais un nombre
 * (règle 8) ; le moteur lance le dé avec la fiche du PNJ. Une action absente
 * de la liste ne se joue pas : on l'ajoute ici, pas dans le prompt.
 */
export type JetPnj = { kind: "skill"; key: Skill; label: string } | { kind: "save"; key: Ability; label: string };

export const NPC_CHECK_ACTIONS = {
  soulever: { kind: "skill", key: "athletics", label: "soulever" },
  pousser: { kind: "skill", key: "athletics", label: "pousser" },
  grimper: { kind: "skill", key: "athletics", label: "grimper" },
  courir: { kind: "skill", key: "athletics", label: "courir" },
  nager: { kind: "skill", key: "athletics", label: "nager" },
  sauter: { kind: "skill", key: "athletics", label: "sauter" },
  esquiver: { kind: "skill", key: "acrobatics", label: "esquiver" },
  garder_equilibre: { kind: "skill", key: "acrobatics", label: "garder l'équilibre" },
  se_cacher: { kind: "skill", key: "stealth", label: "se cacher" },
  escamoter: { kind: "skill", key: "sleight_of_hand", label: "escamoter" },
  reperer: { kind: "skill", key: "perception", label: "repérer" },
  jauger: { kind: "skill", key: "insight", label: "jauger quelqu'un" },
  fouiller: { kind: "skill", key: "investigation", label: "fouiller" },
  mentir: { kind: "skill", key: "deception", label: "mentir" },
  convaincre: { kind: "skill", key: "persuasion", label: "convaincre" },
  intimider: { kind: "skill", key: "intimidation", label: "intimider" },
  calmer_animal: { kind: "skill", key: "animal_handling", label: "calmer un animal" },
  soigner: { kind: "skill", key: "medicine", label: "soigner" },
  pister: { kind: "skill", key: "survival", label: "pister" },
  se_souvenir: { kind: "skill", key: "history", label: "se souvenir" },
  resister_poison: { kind: "save", key: "con", label: "résister (Constitution)" },
  resister_esprit: { kind: "save", key: "wis", label: "résister (Sagesse)" },
  echapper: { kind: "save", key: "dex", label: "échapper (Dextérité)" },
} as const satisfies Record<string, JetPnj>;
export type NpcCheckAction = keyof typeof NPC_CHECK_ACTIONS;
export const NPC_CHECK_ACTION_KEYS = Object.keys(NPC_CHECK_ACTIONS) as [NpcCheckAction, ...NpcCheckAction[]];

/** Les noms de compétence d'une fiche (« Skill: Perception », « Discrétion »), en anglais ou en français, vers la clé `Skill`. */
const NOMS_DE_COMPETENCE: Readonly<Record<string, Skill>> = {
  acrobaties: "acrobatics",
  dressage: "animal_handling",
  arcanes: "arcana",
  athletisme: "athletics",
  tromperie: "deception",
  histoire: "history",
  perspicacite: "insight",
  medecine: "medicine",
  representation: "performance",
  escamotage: "sleight_of_hand",
  discretion: "stealth",
  survie: "survival",
};

function cleDeCompetence(nom: string): Skill | null {
  const net = nom
    .replace(/^skill:\s*/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (net in SKILL_ABILITIES) return net as Skill;
  return NOMS_DE_COMPETENCE[net] ?? null;
}

const modificateur = (valeur: number): number => Math.floor((valeur - 10) / 2);

/**
 * Le modificateur du jet, lu sur la fiche allégée : le bonus de compétence ou
 * de sauvegarde quand la fiche le porte (il est déjà total dans le SRD),
 * sinon le modificateur de la caractéristique.
 */
export function modificateurJetPnj(
  fiche: { abilities: Record<Ability, number>; skills?: Record<string, number>; saving_throws?: Partial<Record<Ability, number>> },
  jet: JetPnj
): number {
  if (jet.kind === "save") return fiche.saving_throws?.[jet.key] ?? modificateur(fiche.abilities[jet.key]);
  for (const [nom, bonus] of Object.entries(fiche.skills ?? {})) if (cleDeCompetence(nom) === jet.key) return bonus;
  return modificateur(fiche.abilities[SKILL_ABILITIES[jet.key]]);
}

/** Un test de PNJ, règles 2024 : d20 + modificateur contre le DD ; ni le 20 ni le 1 ne décident seuls. */
export function resoudreJetPnj(mod: number, dc: number, rng: { nextInt(max: number): number }): { naturel: number; total: number; reussi: boolean } {
  const naturel = rng.nextInt(20) + 1;
  const total = naturel + mod;
  return { naturel, total, reussi: total >= dc };
}
