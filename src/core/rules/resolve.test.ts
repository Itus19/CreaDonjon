import { describe, expect, it } from "vitest";
import { applyOverrides, jsonMergePatch } from "./resolve";

describe("jsonMergePatch", () => {
  it("fusionne un patch objet dans la cible, champ par champ", () => {
    expect(jsonMergePatch({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("retire une cle quand le patch porte null sur cette cle (RFC 7386)", () => {
    expect(jsonMergePatch({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 });
  });

  it("remplace entierement la cible quand le patch n'est pas un objet (tableau, scalaire, null)", () => {
    expect(jsonMergePatch({ a: 1 }, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(jsonMergePatch({ a: 1 }, "texte")).toBe("texte");
    expect(jsonMergePatch({ a: 1 }, null)).toBeNull();
  });

  it("fusionne recursivement les sous-objets imbriques", () => {
    expect(jsonMergePatch({ segments: [{ text: "base" }], meta: { x: 1 } }, { meta: { y: 2 } })).toEqual({
      segments: [{ text: "base" }],
      meta: { x: 1, y: 2 },
    });
  });

  it("cree la cle quand la cible ne l'a pas encore", () => {
    expect(jsonMergePatch({}, { a: 1 })).toEqual({ a: 1 });
  });
});

describe("applyOverrides", () => {
  const baseEntry = {
    entry_key: "fireball",
    entry_type: "spell",
    blocks: [
      { block_type: "description", display: {}, data: { segments: [{ text: "Une boule de feu." }] }, display_order: 100 },
      {
        block_type: "effects",
        display: {},
        data: { effects: [{ id: "e1", damage_type: "Fire", formula: { op: "dice", count: 8, faces: 6 } }] },
        display_order: 300,
      },
    ],
  };

  it("sans surcharge, renvoie l'entree de base inchangee, non desactivee, sans bloc modifie", () => {
    const resolved = applyOverrides(baseEntry, []);
    expect(resolved).toEqual({ ...baseEntry, disabled: false, modifiedBlockTypes: [] });
  });

  it("'Chez moi la boule de feu fait 6d6' : patch_block sur effects, le reste suit la base", () => {
    const resolved = applyOverrides(baseEntry, [
      {
        block_type: "effects",
        action: "patch_block",
        payload: null,
        patch: { effects: [{ id: "e1", damage_type: "Fire", formula: { op: "dice", count: 6, faces: 6 } }] },
      },
    ]);
    expect(resolved?.disabled).toBe(false);
    expect(resolved?.modifiedBlockTypes).toEqual(["effects"]);
    const effectsBlock = resolved?.blocks.find((b) => b.block_type === "effects");
    expect(effectsBlock?.data).toEqual({
      effects: [{ id: "e1", damage_type: "Fire", formula: { op: "dice", count: 6, faces: 6 } }],
    });
    // La description, jamais visee par la surcharge, suit toujours la base.
    const descriptionBlock = resolved?.blocks.find((b) => b.block_type === "description");
    expect(descriptionBlock?.data).toEqual(baseEntry.blocks[0].data);
  });

  it("replace_block remplace le bloc entier, pas une fusion", () => {
    const resolved = applyOverrides(baseEntry, [
      {
        block_type: "description",
        action: "replace_block",
        payload: { block_type: "description", display: {}, data: { segments: [{ text: "Texte remplace." }] }, display_order: 100 },
        patch: null,
      },
    ]);
    const descriptionBlock = resolved?.blocks.find((b) => b.block_type === "description");
    expect(descriptionBlock?.data).toEqual({ segments: [{ text: "Texte remplace." }] });
  });

  it("add_block ajoute un bloc qui n'existait pas sur la base", () => {
    const resolved = applyOverrides(baseEntry, [
      {
        block_type: "custom_table",
        action: "add_block",
        payload: { block_type: "custom_table", display: {}, data: { columns: ["a"], rows: [] }, display_order: 900 },
        patch: null,
      },
    ]);
    expect(resolved?.blocks.map((b) => b.block_type)).toContain("custom_table");
    expect(resolved?.modifiedBlockTypes).toEqual(["custom_table"]);
  });

  it("remove_block retire un bloc de la base", () => {
    const resolved = applyOverrides(baseEntry, [{ block_type: "description", action: "remove_block", payload: null, patch: null }]);
    expect(resolved?.blocks.map((b) => b.block_type)).toEqual(["effects"]);
  });

  it("disable_entry marque l'entree desactivee sans en retirer les blocs", () => {
    const resolved = applyOverrides(baseEntry, [{ block_type: null, action: "disable_entry", payload: null, patch: null }]);
    expect(resolved?.disabled).toBe(true);
    expect(resolved?.blocks).toEqual(baseEntry.blocks);
  });

  it("replace_entry remplace l'entree entiere et leve la desactivation eventuelle", () => {
    const replacement = { entry_key: "fireball", entry_type: "spell", blocks: [] };
    const resolved = applyOverrides(baseEntry, [
      { block_type: null, action: "disable_entry", payload: null, patch: null },
      { block_type: null, action: "replace_entry", payload: replacement, patch: null },
    ]);
    expect(resolved?.disabled).toBe(false);
    expect(resolved?.blocks).toEqual([]);
  });

  it("add_entry n'a d'effet que si aucune entree de base n'existe", () => {
    const created = { entry_key: "maison-only", entry_type: "rule", blocks: [] };
    expect(applyOverrides(null, [{ block_type: null, action: "add_entry", payload: created, patch: null }])).toEqual({
      ...created,
      disabled: false,
      modifiedBlockTypes: [],
    });
    // Une base existe deja : add_entry ne l'ecrase pas (ce n'est pas son role, c'est replace_entry).
    const resolved = applyOverrides(baseEntry, [{ block_type: null, action: "add_entry", payload: created, patch: null }]);
    expect(resolved?.entry_key).toBe("fireball");
  });

  it("plusieurs surcharges s'appliquent dans l'ordre donne, chacune sur le resultat de la precedente", () => {
    const resolved = applyOverrides(baseEntry, [
      { block_type: "effects", action: "patch_block", payload: null, patch: { effects: [{ id: "e1", damage_type: "Fire" }] } },
      { block_type: "effects", action: "patch_block", payload: null, patch: { effects: [{ id: "e1", damage_type: "Cold" }] } },
    ]);
    const effectsBlock = resolved?.blocks.find((b) => b.block_type === "effects");
    expect(effectsBlock?.data).toEqual({ effects: [{ id: "e1", damage_type: "Cold" }] });
  });

  it("sans entree de base et sans add_entry, renvoie null", () => {
    expect(applyOverrides(null, [{ block_type: "effects", action: "patch_block", payload: null, patch: {} }])).toBeNull();
  });
});
