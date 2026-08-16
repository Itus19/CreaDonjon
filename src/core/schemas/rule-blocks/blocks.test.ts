import { describe, expect, it } from "vitest";
import {
  validateBlockData,
  zActionsBlockData,
  zArmorBlockData,
  zBackgroundBlockData,
  zChargesBlockData,
  zClassBasicsBlockData,
  zClassProgressionBlockData,
  zConditionEffectsBlockData,
  zCustomTableBlockData,
  zDescriptionBlockData,
  zEffectsBlockData,
  zItemPropertiesBlockData,
  zPrerequisitesBlockData,
  zScalingBlockData,
  zSpellCastingBlockData,
  zSpellcastingProgressionBlockData,
  zStatBlockBlockData,
  zSubclassFeaturesBlockData,
  zSubclassSlotBlockData,
  zTraitsBlockData,
  zWeaponBlockData,
} from "./blocks";

describe("zDescriptionBlockData", () => {
  it("accepte une liste de segments", () => {
    expect(zDescriptionBlockData.parse({ segments: [{ text: "Un texte." }] })).toEqual({
      segments: [{ text: "Un texte." }],
    });
  });
});

describe("zSpellCastingBlockData", () => {
  it("accepte une fiche d'incantation complete", () => {
    const data = {
      level: 3,
      school: "Evocation",
      casting_time: "1 action",
      range: "150 feet",
      components: ["V", "S", "M"],
      material: "Un peu de guano de chauve-souris et de soufre.",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
    };
    expect(zSpellCastingBlockData.parse(data)).toEqual(data);
  });

  it("refuse un composant inconnu", () => {
    expect(() =>
      zSpellCastingBlockData.parse({
        level: 1,
        school: "Evocation",
        casting_time: "1 action",
        range: "self",
        components: ["X"],
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
      })
    ).toThrow();
  });
});

describe("zEffectsBlockData", () => {
  it("accepte une liste d'effets avec formule", () => {
    const data = {
      effects: [
        {
          id: "e1",
          damage_type: "fire",
          formula: { op: "dice", count: 8, faces: 6 },
          save: { ability: "dex", effect_on_success: "half" },
        },
      ],
    };
    expect(zEffectsBlockData.parse(data)).toEqual(data);
  });
});

describe("zScalingBlockData", () => {
  it("accepte une table de paliers (cas de l'import SRD)", () => {
    const data = {
      axis: "slot_level",
      base: 2,
      rule: null,
      table: { "3": "5d4", "4": "6d4" },
    };
    expect(zScalingBlockData.parse(data)).toEqual(data);
  });

  it("accepte une regle reguliere plutot qu'une table", () => {
    const data = {
      axis: "slot_level",
      base: 3,
      rule: {
        kind: "delta_per_step",
        target: "effects.e1.damage.formula",
        per_step: { op: "dice", count: 1, faces: 6 },
      },
      table: null,
    };
    expect(zScalingBlockData.parse(data)).toEqual(data);
  });
});

describe("zClassProgressionBlockData", () => {
  it("accepte des colonnes declarees et des lignes en donnees", () => {
    const data = {
      max_level: 20,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" },
        { key: "features", label: { fr: "Aptitudes" }, kind: "grants" },
      ],
      rows: [{ level: 1, features: [{ feature: "rage" }] }],
    };
    expect(zClassProgressionBlockData.parse(data)).toEqual(data);
  });
});

describe("zCustomTableBlockData (l'echappatoire)", () => {
  it("accepte des colonnes et lignes libres", () => {
    const data = { columns: ["field", "value"], rows: [{ field: "weight", value: "2" }] };
    expect(zCustomTableBlockData.parse(data)).toEqual(data);
  });
});

describe("zWeaponBlockData", () => {
  it("accepte une dague (arme legere, finesse, lancer)", () => {
    const data = {
      category: "simple",
      is_ranged: false,
      damage: { dice: { op: "dice", count: 1, faces: 4 }, type: "piercing" },
      properties: [
        { kind: "rule", key: "weapon-property-finesse" },
        { kind: "rule", key: "weapon-property-light" },
        { kind: "rule", key: "weapon-property-thrown" },
      ],
      range: { normal: { value: 20, unit: "ft" }, long: { value: 60, unit: "ft" } },
      weight: { value: 1, unit: "lb" },
      cost: { value: 2, unit: "gp" },
    };
    expect(zWeaponBlockData.parse(data)).toEqual(data);
  });

  it("refuse une categorie inconnue", () => {
    expect(() => zWeaponBlockData.parse({ category: "legendary", is_ranged: false, damage: { dice: { op: "num", value: 1 } }, properties: [] })).toThrow();
  });
});

describe("zArmorBlockData", () => {
  it("accepte une cuirasse (armure moyenne, bonus Dex plafonne)", () => {
    const data = { category: "medium", base_ac: 14, dex_bonus: true, max_dex_bonus: 2, weight: { value: 20, unit: "lb" }, cost: { value: 400, unit: "gp" } };
    expect(zArmorBlockData.parse(data)).toEqual(data);
  });
});

describe("zItemPropertiesBlockData", () => {
  it("accepte un objet magique avec rarete et attunement", () => {
    const data = { rarity: "legendary", requires_attunement: true, category: "Wondrous Item" };
    expect(zItemPropertiesBlockData.parse(data)).toEqual(data);
  });
});

describe("zChargesBlockData", () => {
  it("accepte un baton avec regeneration a l'aube", () => {
    const data = { max: 7, regain: "1d6+1 a l'aube", depleted_effect: "1% de chance de se detruire par charge utilisee" };
    expect(zChargesBlockData.parse(data)).toEqual(data);
  });
});

describe("zStatBlockBlockData", () => {
  it("accepte un gobelin", () => {
    const data = {
      size: "Small",
      creature_type: "humanoid",
      alignment: "neutral evil",
      armor_class: 15,
      hit_points: 7,
      hit_dice: "2d6",
      speed: { walk: "30 ft." },
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      senses: { darkvision: "60 ft.", passive_perception: "9" },
      languages: "Common, Goblin",
      challenge_rating: 0.25,
      proficiency_bonus: 2,
    };
    expect(zStatBlockBlockData.parse(data)).toEqual(data);
  });
});

describe("zTraitsBlockData", () => {
  it("accepte une liste d'aptitudes speciales", () => {
    const data = { traits: [{ name: "Nimble Escape", description: "The goblin can take the Disengage or Hide action as a bonus action." }] };
    expect(zTraitsBlockData.parse(data)).toEqual(data);
  });
});

describe("zActionsBlockData", () => {
  it("accepte une action d'attaque avec formule de degats", () => {
    const data = {
      actions: [
        {
          name: "Scimitar",
          description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target.",
          attack_bonus: 4,
          damage: [{ dice: { op: "add", args: [{ op: "dice", count: 1, faces: 6 }, { op: "num", value: 2 }] }, type: "slashing" }],
        },
      ],
    };
    expect(zActionsBlockData.parse(data)).toEqual(data);
  });
});

describe("zPrerequisitesBlockData", () => {
  it("accepte une liste de prerequis en texte court", () => {
    const data = { items: ["Force 13 ou plus"] };
    expect(zPrerequisitesBlockData.parse(data)).toEqual(data);
  });
});

describe("zClassBasicsBlockData", () => {
  it("accepte les bases du Magicien", () => {
    const data = {
      hit_die: 6,
      saving_throw_proficiencies: ["int", "wis"],
      weapon_proficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    };
    expect(zClassBasicsBlockData.parse(data)).toEqual(data);
  });
});

describe("zSpellcastingProgressionBlockData", () => {
  it("accepte la progression d'incantation du Magicien", () => {
    const data = {
      ability: "int",
      starts_at_level: 1,
      info: [{ name: "Cantrips", description: "At 1st level, you know three cantrips of your choice." }],
    };
    expect(zSpellcastingProgressionBlockData.parse(data)).toEqual(data);
  });
});

describe("zSubclassSlotBlockData", () => {
  it("accepte le choix de tradition arcanique du Magicien", () => {
    const data = { label: "Tradition arcanique", chosen_at_level: 2, options: [{ kind: "rule", key: "evocation" }] };
    expect(zSubclassSlotBlockData.parse(data)).toEqual(data);
  });
});

describe("zBackgroundBlockData", () => {
  it("accepte l'historique Criminel", () => {
    const data = {
      ability_scores: ["dex", "con", "int"],
      feat: { kind: "rule", key: "alert" },
      skill_proficiencies: ["sleight_of_hand", "stealth"],
      tool_proficiency: "Thieves' Tools",
      equipment_options: [
        {
          label: "A",
          items: [
            { ref: { kind: "rule", key: "dagger" }, label: "Dagger", quantity: 2 },
            { ref: { kind: "rule", key: "thieves-tools" }, label: "Thieves' Tools", quantity: 1 },
          ],
          gold: { value: 16, unit: "gp" },
        },
        { label: "B", items: [], gold: { value: 50, unit: "gp" } },
      ],
    };
    expect(zBackgroundBlockData.parse(data)).toEqual(data);
  });

  it("accepte l'absence de maitrise d'outil fixe (choix libre, ex. Soldat)", () => {
    const data = {
      ability_scores: ["str", "dex", "con"],
      feat: { kind: "rule", key: "savage-attacker" },
      skill_proficiencies: ["athletics", "intimidation"],
      equipment_options: [
        { label: "A", items: [{ label: "Boîte de jeux (au choix)", quantity: 1 }], gold: { value: 14, unit: "gp" } },
        { label: "B", items: [], gold: { value: 50, unit: "gp" } },
      ],
    };
    expect(zBackgroundBlockData.parse(data)).toEqual(data);
  });
});

describe("zConditionEffectsBlockData", () => {
  it("accepte les effets d'Inconscient (V1-D7)", () => {
    const data = {
      effects: [
        { name: "Inerte", description: "Vous subissez les états À terre et Neutralisé." },
        { name: "Vitesse 0", description: "Votre Vitesse est de 0 et ne peut pas augmenter." },
      ],
    };
    expect(zConditionEffectsBlockData.parse(data)).toEqual(data);
  });
});

describe("zSubclassFeaturesBlockData", () => {
  it("accepte les aptitudes du Domaine de la Vie, non triees par niveau (V1-D7)", () => {
    const data = {
      features: [
        { name: "Guérison suprême", level: 17, description: "..." },
        { name: "Disciple de la Vie", level: 3, description: "..." },
      ],
    };
    expect(zSubclassFeaturesBlockData.parse(data)).toEqual(data);
  });
});

describe("validateBlockData", () => {
  it("route vers le bon schema selon block_type", () => {
    expect(() => validateBlockData("description", { segments: [] })).not.toThrow();
    expect(() => validateBlockData("description", { segments: "pas un tableau" })).toThrow();
  });
});
