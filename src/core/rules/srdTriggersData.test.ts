import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { zTrigger } from "./triggers";
import { validateBlockData } from "../schemas/rule-blocks/blocks";

/**
 * `data/srd/triggers-2024.json` est de la DONNÉE saisie à la main : c'est
 * donc exactement ce qui peut se tromper sans que rien ne le dise. Un
 * déclencheur mal écrit passerait l'import (validé là-bas aussi) mais une
 * faute de frappe dans une clé d'entrée ne se verrait jamais — la règle
 * s'attacherait à une fiche inexistante, en silence.
 */

const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/triggers-2024.json"), "utf-8")) as Record<
  string,
  { triggers?: unknown[] }
>;

const SRD = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/srd-2024.json"), "utf-8")) as Record<
  string,
  { index?: string }[]
>;

const entrees = Object.entries(RAW).filter(([k]) => !k.startsWith("_"));

describe("les déclencheurs SRD écrits à la main", () => {
  it("il y en a au moins un — sinon le fichier ne sert à rien", () => {
    expect(entrees.length).toBeGreaterThan(0);
  });

  it("chaque déclencheur est valide au sens du moteur", () => {
    for (const [key, value] of entrees) {
      for (const t of value.triggers ?? []) {
        const parsed = zTrigger.safeParse(t);
        expect(parsed.success, `${key} : ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`).toBe(true);
      }
    }
  });

  it("chaque bloc produit est un bloc `triggers` valide", () => {
    for (const [, value] of entrees) {
      expect(() => validateBlockData("triggers", { triggers: value.triggers })).not.toThrow();
    }
  });

  it("chaque clé désigne une VRAIE entrée du SRD 2024", () => {
    // Le piège silencieux : une faute de frappe attacherait la règle à une
    // fiche inexistante, et l'import ne s'en apercevrait jamais.
    const connues = new Set<string>();
    for (const liste of Object.values(SRD)) {
      if (!Array.isArray(liste)) continue;
      for (const e of liste) if (e?.index) connues.add(e.index);
    }
    for (const [key] of entrees) {
      expect(connues.has(key), `clé inconnue du SRD : ${key}`).toBe(true);
    }
  });

  it("chaque entrée documente la règle qu'elle traduit", () => {
    // Un déclencheur sans sa phrase source est invérifiable : personne ne
    // pourra dire s'il est fidèle au texte.
    for (const [key, value] of entrees) {
      expect((value as { _regle?: string })._regle, `${key} sans _regle`).toBeTruthy();
    }
  });
});
