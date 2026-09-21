import { describe, expect, it } from "vitest";
import { dataSchemaForBlockType, isBlockType, parseBlockData, validateBlockData } from "./blocks";
import {
  dataSchemaForBlockType as dataSchemaForWikiBlock,
  isBlockType as isWikiBlockType,
} from "../blocks/registry";

/**
 * Un `block_type` venu de la BASE ou d'un import n'est qu'une chaine. Le
 * caster en `BlockType` faisait mentir le typage, jusqu'a ce qu'un `.parse`
 * de `undefined` fasse tomber la resolution de TOUTE une fiche sur un
 * « Cannot read properties of undefined » — constate le 21 septembre 2026
 * sur une surcharge `add_block` sans `block_type`.
 *
 * Ces tests verrouillent les trois comportements qui remplacent ce plantage :
 * une recherche honnete, un garde de type, et un verdict par bloc.
 */

describe("la recherche de schema dit quand elle ne sait pas", () => {
  it("rend `undefined` pour un type hors catalogue, au lieu d'un schema fantome", () => {
    expect(dataSchemaForBlockType("bloc_invente" as never)).toBeUndefined();
    expect(dataSchemaForWikiBlock("bloc_invente" as never)).toBeUndefined();
  });

  it("rend bien un schema pour un type du catalogue", () => {
    expect(dataSchemaForBlockType("triggers")).toBeDefined();
    expect(dataSchemaForBlockType("modifiers")).toBeDefined();
  });
});

describe("isBlockType", () => {
  it("distingue les deux catalogues, qui ne sont pas le meme", () => {
    // `triggers` est un bloc de REGLE, pas un bloc de wiki : confondre les
    // deux registres ferait accepter n'importe quoi de travers.
    expect(isBlockType("triggers")).toBe(true);
    expect(isWikiBlockType("triggers")).toBe(false);
    expect(isWikiBlockType("random_table")).toBe(true);
  });

  it("refuse une chaine vide et un heritage d'Object", () => {
    expect(isBlockType("")).toBe(false);
    // `"constructor" in obj` serait vrai : d'ou `hasOwnProperty`.
    expect(isBlockType("constructor")).toBe(false);
    expect(isBlockType("toString")).toBe(false);
  });
});

describe("parseBlockData : un verdict par bloc, jamais une exception", () => {
  it("accepte un bloc valide et rend sa donnee analysee", () => {
    const out = parseBlockData("modifiers", { modifiers: [] });
    expect(out).toEqual({ ok: true, blockType: "modifiers", data: { modifiers: [] } });
  });

  it("ecarte un type inconnu en le NOMMANT, au lieu de lever", () => {
    // C'est le cas exact qui faisait tomber la fiche entiere.
    expect(parseBlockData("", {})).toEqual({ ok: false, reason: "type de bloc inconnu" });
    expect(parseBlockData("bloc_invente", {})).toEqual({ ok: false, reason: "type de bloc inconnu" });
  });

  it("ecarte une donnee invalide en disant ce qui cloche", () => {
    const out = parseBlockData("modifiers", { modifiers: "pas un tableau" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("modifiers");
  });
});

describe("validateBlockData : la ou l'inconnu est une faute", () => {
  it("leve une erreur qui NOMME le type, pas un TypeError opaque", () => {
    // Avant : « Cannot read properties of undefined (reading 'parse') ».
    expect(() => validateBlockData("bloc_invente" as never, {})).toThrow(/bloc_invente/);
    expect(() => validateBlockData("bloc_invente" as never, {})).not.toThrow(TypeError);
  });
});
