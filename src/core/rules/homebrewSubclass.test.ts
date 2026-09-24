import { describe, expect, it } from "vitest";
import { buildHomebrewSubclassEntry, subclassSlotWrite } from "./homebrewSubclass";
import { applyOverrides } from "./resolve";

describe("buildHomebrewSubclassEntry", () => {
  const base = {
    name: "  Arnaqueur arcanique ",
    parentClassKey: "rogue",
    description: "",
    pageRef: "",
    features: [{ name: "Incantation", level: 3, description: "Voir la table." }],
  };

  it("porte la classe parente et les aptitudes", () => {
    const entry = buildHomebrewSubclassEntry(base);
    expect(entry.name).toBe("Arnaqueur arcanique");
    expect(entry.entry_type).toBe("subclass");
    expect(entry.parent_class_key).toBe("rogue");
    expect(entry.blocks).toEqual([
      { block_type: "subclass_features", data: { features: [{ name: "Incantation", level: 3, description: "Voir la table." }] } },
    ]);
  });

  it("n'ecrit aucun bloc description quand rien n'est rempli", () => {
    expect(buildHomebrewSubclassEntry(base).blocks.some((b) => b.block_type === "description")).toBe(false);
  });

  it("omet page_ref quand il est vide, jamais en null", () => {
    const entry = buildHomebrewSubclassEntry({ ...base, description: "Un roublard qui manie la magie." });
    const description = entry.blocks.find((b) => b.block_type === "description");
    expect(description?.data).toEqual({ segments: [{ text: "Un roublard qui manie la magie." }] });
    expect(description?.data).not.toHaveProperty("page_ref");
  });

  it("ecrit une reference de page seule, sans texte", () => {
    const entry = buildHomebrewSubclassEntry({ ...base, pageRef: " MdJ 2024, p. 131 " });
    const description = entry.blocks.find((b) => b.block_type === "description");
    expect(description?.data).toEqual({ segments: [], page_ref: "MdJ 2024, p. 131" });
  });

  it("met la description avant les aptitudes", () => {
    const entry = buildHomebrewSubclassEntry({ ...base, description: "Texte." });
    expect(entry.blocks.map((b) => b.block_type)).toEqual(["description", "subclass_features"]);
  });

  it("ecarte une aptitude sans nom et trie par niveau", () => {
    const entry = buildHomebrewSubclassEntry({
      ...base,
      features: [
        { name: "Voleur de sorts", level: 17, description: "" },
        { name: "  ", level: 9, description: "oubliee" },
        { name: " Incantation ", level: 3, description: " Voir la table. " },
      ],
    });
    const features = entry.blocks.find((b) => b.block_type === "subclass_features")?.data;
    expect(features).toEqual({
      features: [
        { name: "Incantation", level: 3, description: "Voir la table." },
        { name: "Voleur de sorts", level: 17, description: "" },
      ],
    });
  });
});

describe("subclassSlotWrite", () => {
  const thief = { kind: "rule" as const, key: "thief" };

  it("sans surcharge a ce niveau : un patch qui porte TOUT le tableau", () => {
    const write = subclassSlotWrite(null, [thief], "arcane-trickster");
    expect(write).toEqual({ action: "patch_block", payload: null, patch: { options: [thief, { kind: "rule", key: "arcane-trickster" }] } });
  });

  it("une classe sans option connue recoit un tableau d'une seule option", () => {
    expect(subclassSlotWrite(null, undefined, "arcane-trickster").patch).toEqual({ options: [{ kind: "rule", key: "arcane-trickster" }] });
  });

  it("n'ajoute pas deux fois la meme option", () => {
    expect(subclassSlotWrite(null, [thief], "thief").patch).toEqual({ options: [thief] });
  });

  it("garde les autres champs d'un patch deja pose a ce niveau (l'upsert le remplace)", () => {
    const existing = { action: "patch_block" as const, payload: null, patch: { label: "Archétype", options: [thief] } };
    expect(subclassSlotWrite(existing, [thief], "arcane-trickster").patch).toEqual({
      label: "Archétype",
      options: [thief, { kind: "rule", key: "arcane-trickster" }],
    });
  });

  it("reecrit un bloc ajoute a ce niveau plutot que de le transformer en patch", () => {
    const payload = { block_type: "subclass_slot", display: {}, data: { label: "Voie", chosen_at_level: 3, options: [thief] }, display_order: 300 };
    const write = subclassSlotWrite({ action: "add_block", payload, patch: null }, [thief], "arcane-trickster");
    expect(write.action).toBe("add_block");
    expect(write.patch).toBeNull();
    expect(write.payload).toEqual({ ...payload, data: { ...payload.data, options: [thief, { kind: "rule", key: "arcane-trickster" }] } });
  });

  it("appliquee par le vrai resolveur, la nouvelle option s'ajoute a celles de la base", () => {
    const base = {
      entry_key: "rogue",
      entry_type: "class",
      blocks: [{ block_type: "subclass_slot", display: {}, data: { label: "Archétype", chosen_at_level: 3, options: [thief] }, display_order: 1 }],
    };
    const write = subclassSlotWrite(null, [thief], "arcane-trickster");
    const resolved = applyOverrides(base, [{ block_type: "subclass_slot", action: write.action, payload: write.payload, patch: write.patch }]);
    expect(resolved?.blocks[0].data).toEqual({ label: "Archétype", chosen_at_level: 3, options: [thief, { kind: "rule", key: "arcane-trickster" }] });
  });
});
