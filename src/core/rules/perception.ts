import { distance, type Point } from "./geometry";

/**
 * V3.1-180 (ADR 0078) — qui voit qui, en fonctions PURES. Les entrées : la
 * lumière ambiante et les sources de lumière (posées sur le plan), les sens
 * de l'observateur (en mètres, comme `sheet.senses`), les états Aveuglé,
 * Invisible et Caché. Aucun dé, aucune base.
 *
 * Sans plan (`planned: false`, moins de deux jetons posés), seuls les états
 * comptent : la lumière et la portée des sens ne se mesurent pas, un sens
 * possédé compte comme à portée.
 */

export type Lighting = "bright" | "dim" | "dark";

/** Une source de lumière : `bright` mètres de lumière vive, puis `dim` mètres de lumière faible au-delà. */
export interface LightSource {
  pos: Point;
  bright: number;
  dim: number;
}

export interface PerceptionWorld {
  ambient: Lighting;
  sources: readonly LightSource[];
  planned: boolean;
}

export interface Perceiver {
  id: string;
  pos: Point | null;
  /** Clés d'états : `blinded`, `invisible`, `hidden`… */
  conditions: readonly string[];
  /** Portées en mètres ; absent : le sens manque. */
  senses: Partial<Record<"darkvision" | "blindsight" | "tremorsense" | "truesight", number>>;
  /** Caché : le total du test de Discrétion qui l'a posé ; `null` ou absent : inconnu (personne ne le trouve). */
  hiddenTotal?: number | null;
}

export type Sight = "clear" | "obscured" | "unseen";

const RANG: Record<Lighting, number> = { dark: 0, dim: 1, bright: 2 };
const EPS = 1e-9;

/** La lumière en un point : la plus vive de l'ambiante et des sources (une source n'assombrit jamais). */
export function lightAt(p: Point | null, world: Pick<PerceptionWorld, "ambient" | "sources">): Lighting {
  let best: Lighting = world.ambient;
  if (!p) return best;
  for (const s of world.sources) {
    const d = distance(s.pos, p);
    const here: Lighting = d <= s.bright + EPS ? "bright" : d <= s.bright + s.dim + EPS ? "dim" : "dark";
    if (RANG[here] > RANG[best]) best = here;
  }
  return best;
}

/**
 * Ce que l'observateur voit de la cible.
 * - On se voit toujours soi-même.
 * - Caché : pas vu tant qu'on ne l'a pas trouvé (`perception` au moins égale au total de Discrétion).
 * - Observateur Aveuglé : seule la perception aveugle (ou des vibrations) à portée perçoit.
 * - Cible Invisible : seules la vision véritable et la perception aveugle (ou des vibrations) à portée la perçoivent.
 * - Ténèbres sur la cible : vision véritable ou perception aveugle → vue ; vision dans le noir → voilée ; sinon non vue.
 * - Lumière faible sur la cible : voilée (désavantage en Perception), sauf vision dans le noir à portée.
 */
export function canSee(observer: Perceiver, target: Perceiver, world: PerceptionWorld, opts: { perception?: number } = {}): Sight {
  if (observer.id === target.id) return "clear";
  const d = world.planned && observer.pos && target.pos ? distance(observer.pos, target.pos) : null;
  const aPortee = (sens: keyof Perceiver["senses"]) => {
    const r = observer.senses[sens];
    if (r === undefined || r <= 0) return false;
    return d === null ? true : d <= r + EPS;
  };
  const sansYeux = aPortee("blindsight") || aPortee("tremorsense");

  if (target.conditions.includes("hidden")) {
    const total = target.hiddenTotal;
    if (opts.perception === undefined || total === null || total === undefined || opts.perception < total) return "unseen";
  }
  if (observer.conditions.includes("blinded")) return sansYeux ? "clear" : "unseen";
  if (target.conditions.includes("invisible") && !(aPortee("truesight") || sansYeux)) return "unseen";

  // Sans plan, la lumière ne se mesure pas.
  if (!world.planned) return "clear";
  const lumiere = lightAt(target.pos, world);
  if (lumiere === "dark") {
    if (aPortee("truesight") || sansYeux) return "clear";
    return aPortee("darkvision") ? "obscured" : "unseen";
  }
  if (lumiere === "dim") return aPortee("darkvision") || aPortee("truesight") || sansYeux ? "clear" : "obscured";
  return "clear";
}

/** Ce que la vue fait à une attaque : cible non vue → désavantage ; attaquant non vu → avantage ; les deux s'annulent. */
export function attackSight(p: { attackerSeesTarget: Sight; targetSeesAttacker: Sight }): "advantage" | "disadvantage" | "normal" {
  const desavantage = p.attackerSeesTarget === "unseen";
  const avantage = p.targetSeesAttacker === "unseen";
  if (avantage && !desavantage) return "advantage";
  if (desavantage && !avantage) return "disadvantage";
  return "normal";
}

/**
 * M15 — une cible que ses règles mettent hors d'atteinte : `untargetable.<étiquette>`
 * (l'Amulette d'antidétection contre la divination) ou `immune.spell.<clé>`.
 */
export function targetingRefusal(
  target: { untargetable: readonly string[]; immuneSpells: readonly string[] },
  by: { tags: readonly string[]; spellKey?: string | null }
): "untargetable" | "immune_spell" | null {
  if (by.spellKey && target.immuneSpells.includes(by.spellKey)) return "immune_spell";
  if (by.tags.some((t) => target.untargetable.includes(t.toLowerCase()))) return "untargetable";
  return null;
}

/** Les états qui comptent pour la vue, quelle que soit leur écriture : clé du moteur ou nom français du menu du MJ. */
const ETATS_VUE: Record<string, "blinded" | "invisible" | "hidden"> = {
  blinded: "blinded", "aveuglé": "blinded", aveugle: "blinded",
  invisible: "invisible",
  hidden: "hidden", "caché": "hidden", cache: "hidden",
};

/** V3.1-180 : les états d'un participant ramenés aux clés que lit `canSee` (les autres sont gardés tels quels). */
export function perceptionConditions(conditions: readonly string[]): string[] {
  return conditions.map((c) => ETATS_VUE[c.trim().toLowerCase()] ?? c);
}

/** Les noms d'un sens dans un bloc de stats, en anglais (SRD) ou en français (wiki), vers la clé de `Perceiver.senses`. */
const NOMS_DE_SENS: [RegExp, keyof Perceiver["senses"]][] = [
  [/darkvision|vision dans le noir/i, "darkvision"],
  [/blindsight|perception aveugle|vision aveugle/i, "blindsight"],
  [/tremorsense|perception des vibrations/i, "tremorsense"],
  [/truesight|vision v[ée]ritable/i, "truesight"],
];

/** « 60 ft. » → 18 (1,5 m pour 5 pieds, comme le SRD français) ; « 18 m » → 18. */
function metres(texte: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(ft|feet|pieds?|m\b|mètres?)/i.exec(texte);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return /^(ft|feet|pied)/i.test(m[2]) ? Math.round(n * 0.3 * 100) / 100 : n;
}

/**
 * V3.1-181 — les sens d'une créature d'après son bloc de stats : un objet
 * (`senses` du JSON du SRD, valeurs en pieds) ou un texte (bloc `statblock`
 * du wiki). Ce qui ne se lit pas est laissé de côté : on ne devine pas.
 */
export function sensesFromStatBlock(raw: Readonly<Record<string, string>> | string | undefined): { senses: Perceiver["senses"]; passivePerception: number | null } {
  const senses: Perceiver["senses"] = {};
  let passivePerception: number | null = null;
  if (!raw) return { senses, passivePerception };
  const morceaux = typeof raw === "string" ? raw.split(/[,;]/) : Object.entries(raw).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`);
  for (const m of morceaux) {
    if (/passive|passive_perception|perception passive/i.test(m)) {
      const n = /(-?\d+)/.exec(m);
      if (n) passivePerception = Number(n[1]);
      continue;
    }
    const sens = NOMS_DE_SENS.find(([re]) => re.test(m));
    const portee = metres(m);
    if (sens && portee !== null) senses[sens[1]] = portee;
  }
  return { senses, passivePerception };
}
