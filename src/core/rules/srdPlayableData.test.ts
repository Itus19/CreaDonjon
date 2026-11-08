import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBlockData } from "../schemas/rule-blocks/blocks";
import { zActivationBlockData, zRuleResourcesBlockData, type ActivationBlockData, type RuleResourcesBlockData } from "../schemas/rule-blocks/playable";
import { evaluate } from "../formula";
import { coverageSummary } from "./activationEditor";

/**
 * V3.1-133 — `data/srd/playable-2024.json` est de la DONNÉE saisie à la main,
 * comme `triggers-2024.json` : ce qui peut se tromper sans que rien ne le
 * dise. Une clé mal tapée attacherait les briques à une fiche inexistante ;
 * une citation qui n'est pas dans le texte ne se surlignerait jamais ; un
 * maximum mal écrit donnerait le mauvais nombre d'usages au mauvais niveau.
 */

type Entree = { _regle?: unknown; resources?: unknown; activation?: unknown; coverage?: unknown };
const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/playable-2024.json"), "utf-8")) as Record<string, Entree>;
const SRD = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/srd-2024.json"), "utf-8")) as Record<string, unknown[]>;
const FR = readFileSync(resolve(process.cwd(), "data/srd/fr-source/srd-5.2.1-fr.txt"), "utf-8");

const entrees = Object.entries(RAW).filter(([k]) => !k.startsWith("_"));

/** Les clés fusionnées par l'import (`dedupeFeatures`) : une aptitude du même nom présente pour plusieurs classes reçoit le slug de son nom. */
function clesFusionnees(): string[] {
  const noms = new Map<string, number>();
  for (const f of (SRD.Features ?? []) as { name?: string }[]) if (f?.name) noms.set(f.name, (noms.get(f.name) ?? 0) + 1);
  return [...noms].filter(([, n]) => n > 1).map(([nom]) => nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
}
const TYPES = ["resources", "activation", "coverage"] as const;

/** Le texte du PDF est coupé en lignes : on compare espaces confondus. */
const plat = (s: string) => s.replace(/\s+/g, " ").trim();
const TEXTE_FR = plat(FR);

function citations(e: Entree): string[] {
  const out: string[] = [];
  if (e.resources) for (const r of (e.resources as RuleResourcesBlockData).resources) if (r.passage) out.push(r.passage);
  if (e.activation) {
    const a = e.activation as ActivationBlockData;
    for (const act of a.activations) out.push(...Object.values(act.passages ?? {}));
    for (const d of a.durable_effects) if (d.passage) out.push(d.passage);
  }
  if (e.coverage) for (const g of (e.coverage as { gaps: { text: string }[] }).gaps) out.push(g.text);
  return out;
}

/** Les colonnes de progression d'une classe à un niveau, comme `progressionAt` les cumule (dernière valeur connue). */
function colonnes(classe: string, niveau: number): Record<string, number> {
  const out: Record<string, number> = {};
  const lignes = (SRD.Levels as { level: number; class?: { index: string }; subclass?: unknown; class_specific?: Record<string, unknown> | null }[])
    .filter((l) => l.class?.index === classe && !l.subclass && l.level <= niveau)
    .sort((a, b) => a.level - b.level);
  for (const l of lignes) {
    for (const [k, v] of Object.entries(l.class_specific ?? {})) if (typeof v === "number") out[`column.class_specific_${k}`] = v;
  }
  return out;
}

function maximum(cle: string, ressource: string, classe: string, niveau: number): number {
  const bloc = zRuleResourcesBlockData.parse(RAW[cle].resources);
  const r = bloc.resources.find((x) => x.key === ressource)!;
  const refs = { ...colonnes(classe, niveau), "class.level": niveau };
  return evaluate(r.max, refs, { nextInt: () => 0 }, "average").value;
}

describe("les règles jouables du SRD écrites à la main", () => {
  it("chaque bloc est valide au sens du moteur", () => {
    for (const [key, e] of entrees) {
      for (const t of TYPES) {
        if (e[t] === undefined) continue;
        expect(() => validateBlockData(t, e[t]), `${key}.${t}`).not.toThrow();
      }
    }
  });

  it("chaque clé désigne une VRAIE entrée du SRD 2024", () => {
    const connues = new Set<string>();
    for (const liste of Object.values(SRD)) {
      if (!Array.isArray(liste)) continue;
      for (const e of liste as { index?: string }[]) if (e?.index) connues.add(e.index);
    }
    // V3.1-167 : une aptitude que l'import fusionne entre classes (même nom, même texte : « Extra Attack ») se vise par sa clé fusionnée.
    for (const k of clesFusionnees()) connues.add(k);
    for (const [key] of entrees) expect(connues.has(key), `clé inconnue du SRD : ${key}`).toBe(true);
  });

  it("chaque entrée documente la règle qu'elle traduit, et porte au moins un bloc", () => {
    for (const [key, e] of entrees) {
      expect(typeof e._regle, key).toBe("string");
      expect(TYPES.some((t) => e[t] !== undefined), key).toBe(true);
    }
  });

  it("chaque citation se trouve mot pour mot dans le texte français du SRD 5.2.1", () => {
    for (const [key, e] of entrees) {
      for (const c of citations(e)) expect(TEXTE_FR.includes(plat(c)), `${key} : « ${c} » absent du texte`).toBe(true);
    }
  });

  it("le nombre d'usages suit les tables du SRD", () => {
    expect([1, 3, 4, 9, 10, 20].map((n) => maximum("fighter-second-wind", "second-wind", "fighter", n))).toEqual([2, 2, 3, 3, 4, 4]);
    expect([2, 16, 17, 20].map((n) => maximum("fighter-action-surge", "action-surge", "fighter", n))).toEqual([1, 1, 2, 2]);
    expect([3, 10, 11, 20].map((n) => maximum("paladin-channel-divinity", "channel-divinity", "paladin", n))).toEqual([2, 2, 3, 3]);
    expect([2, 5, 6, 17, 18].map((n) => maximum("cleric-channel-divinity", "channel-divinity", "cleric", n))).toEqual([2, 2, 3, 3, 4]);
  });

  it("Abjuration d'ennemis dépense le Conduit divin que le Paladin et le Clerc déclarent", () => {
    const abjure = zActivationBlockData.parse(RAW["paladin-abjure-foes"].activation);
    expect(abjure.activations[0].cost.resources.map((r) => r.key)).toEqual(["channel-divinity"]);
    for (const k of ["paladin-channel-divinity", "cleric-channel-divinity"]) {
      expect(zRuleResourcesBlockData.parse(RAW[k].resources).resources.map((r) => r.key)).toContain("channel-divinity");
    }
  });

  it("V3.1-192 : Frappe malicieuse propose ses trois effets, avec le DD 8 + Dex + maîtrise", () => {
    const fm = zActivationBlockData.parse(RAW["rogue-cunning-strike"].activation).activations[0];
    expect(fm.variants?.map((v) => v.id)).toEqual(["trip", "poison", "withdraw"]);
    const effet = fm.variants?.[0].effects[0];
    if (effet?.action !== "saving_throw") throw new Error("sauvegarde attendue");
    expect(evaluate(effet.dc, { "ability.dex": 4, proficiency: 3 }, { nextInt: () => 0 }, "average").value).toBe(15);
  });

  it("couverture : Second souffle est jouable ; Fougue et Abjuration le sont en partie, et le disent", () => {
    const etat = (k: string) =>
      coverageSummary(TYPES.filter((t) => RAW[k][t] !== undefined).map((t) => ({ blockType: t, data: validateBlockData(t, RAW[k][t]) }))).state;
    expect(etat("fighter-second-wind")).toBe("playable");
    expect(etat("fighter-action-surge")).toBe("partial");
    expect(etat("paladin-abjure-foes")).toBe("partial");
  });
});
