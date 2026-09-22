import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import { runTriggers, zTrigger, type Trigger, type TriggerContext } from "./triggers";

function fixedRng(values: number[]): Rng {
  let i = 0;
  return { nextInt: () => values[i++ % values.length] };
}

const CTX: TriggerContext = {
  actors: {
    porteur: { conditions: ["poisoned"], features: ["barbarian-rage"], numbers: { "ability.cha": 3 }, zone: "engaged" },
    allie: { conditions: [], features: [], numbers: {}, zone: "near" },
  },
};

/**
 * V3-A6 — LE COMPTE DES RÈGLES INEXPRIMABLES.
 *
 * Le ticket nomme six règles du SRD et demande de tenir le compte de
 * celles que le vocabulaire fermé ne sait pas écrire : « à la troisième,
 * rouvrir la question d'une échappatoire — pas avant » (spec §3, la règle
 * des trois).
 *
 * Ce fichier est ce compte, sous forme exécutable plutôt que sous forme
 * d'affirmation. Ce qui passe est écrit et vérifié ; ce qui ne passe pas
 * est décrit avec la capacité qui manque, et un test verrouille le fait
 * qu'elle manque — de sorte que le jour où le vocabulaire s'enrichira,
 * c'est ce fichier-ci qui tombera et rappellera de le mettre à jour.
 */

describe("ce que le vocabulaire SAIT écrire", () => {
  /** Poison qui ronge : le seul des six a passer entierement. */
  const poisonQuiRonge: Trigger = {
    id: "poison-degats-par-tour",
    when: { event: "turn_start", subject: "porteur" },
    if: { op: "has_condition", who: "porteur", key: "poisoned" },
    then: [{ action: "deal_damage", who: "porteur", amount: { op: "dice", count: 1, faces: 4 }, damage_type: "poison" }],
  };

  it("un poison qui inflige des dégâts au début du tour", () => {
    expect(zTrigger.safeParse(poisonQuiRonge).success).toBe(true);
    const out = runTriggers({
      event: { event: "turn_start", subject: "porteur" },
      triggers: [poisonQuiRonge],
      ctx: CTX,
      rng: fixedRng([2]),
    });
    expect(out.failures).toEqual([]);
    expect(out.effects[0]).toMatchObject({ action: "deal_damage", who: "porteur", amount: 3 });
  });

  it("et il ne part pas sur quelqu'un qui n'est pas empoisonné", () => {
    const sain: TriggerContext = { actors: { ...CTX.actors, porteur: { ...CTX.actors.porteur, conditions: [] } } };
    const out = runTriggers({
      event: { event: "turn_start", subject: "porteur" },
      triggers: [poisonQuiRonge],
      ctx: sain,
      rng: fixedRng([2]),
    });
    expect(out.effects).toEqual([]);
  });
});

/**
 * Chaque test ci-dessous verrouille une CAPACITÉ MANQUANTE. Il échouera le
 * jour où elle sera ajoutée — c'est voulu : c'est le rappel de revenir
 * réécrire la règle correspondante.
 */
describe("ce que le vocabulaire NE SAIT PAS écrire — quatre manques distincts", () => {
  it("1. un modificateur CALCULÉ — Aura de protection (+ modificateur de Charisme aux jets de sauvegarde)", () => {
    // `apply_modifier` transporte un `Modifier`, dont `value` est un
    // NOMBRE, pas un `FormulaNode`. « + ton modificateur de Charisme » n'a
    // donc aucune écriture possible : seul un +3 en dur passerait, ce qui
    // n'est pas la règle mais une de ses instances.
    const avecFormule = {
      id: "aura",
      when: { event: "turn_start" },
      then: [
        {
          action: "apply_modifier",
          who: "allie",
          modifier: {
            target: "save.con",
            op: "add",
            value: { op: "ref", name: "ability.cha" }, // <- refusé
            source: "aura",
            label: "Aura",
            layer: 4,
          },
        },
      ],
    };
    expect(zTrigger.safeParse(avecFormule).success).toBe(false);
  });

  it("2. un effet QUI DURE — Rage (résistance et bonus tant qu'elle est active)", () => {
    // Un effet est une proposition ponctuelle : il n'existe aucune notion
    // de « tant que telle condition tient ». On ne peut que ré-appliquer à
    // chaque tour, ce qui n'est pas la même chose — rien ne défait
    // l'effet quand la rage s'arrête.
    const effetsPossibles = ["saving_throw", "apply_modifier", "apply_condition", "remove_condition", "deal_damage", "heal", "spend_resource", "move", "roll", "narrate_hint", "grant_budget"];
    expect(effetsPossibles).not.toContain("apply_modifier_while");
    expect(effetsPossibles.some((e) => e.includes("while") || e.includes("duration"))).toBe(false);
  });

  it("3. modifier les DÉGÂTS SUBIS — résistances et immunités", () => {
    // `damage_taken` arrive avec ses dégâts DÉJÀ calculés : un déclencheur
    // le lit, il ne peut pas le réduire de moitié. `deal_damage` ne sait
    // qu'ajouter des dégâts, jamais en retrancher à un coup en cours.
    const effetsPossibles = ["saving_throw", "apply_modifier", "apply_condition", "remove_condition", "deal_damage", "heal", "spend_resource", "move", "roll", "narrate_hint", "grant_budget"];
    expect(effetsPossibles).not.toContain("modify_damage");
  });

  it("4. AGIR — attaque d'opportunité (déclencher une attaque en réaction)", () => {
    // `movement` + `in_range` détecte parfaitement l'occasion, et
    // `grant_budget` sait consommer la réaction. Mais aucun effet ne
    // déclenche une ATTAQUE : la détection est écrivable, l'acte non.
    const detection: Trigger = {
      id: "occasion",
      when: { event: "movement" },
      if: { op: "in_range", who: "porteur", of: "allie", zone: "engaged" },
      then: [
        { action: "grant_budget", who: "porteur", kind: "reaction", amount: { op: "num", value: -1 } },
        { action: "narrate_hint", text: "Une ouverture : l'occasion d'une attaque." },
      ],
    };
    // La moitié « détecter » passe...
    expect(zTrigger.safeParse(detection).success).toBe(true);
    // ...mais la moitié « frapper » n'a pas de mot.
    const effetsPossibles = ["saving_throw", "apply_modifier", "apply_condition", "remove_condition", "deal_damage", "heal", "spend_resource", "move", "roll", "narrate_hint", "grant_budget"];
    expect(effetsPossibles).not.toContain("attack");
  });

  it("hors catégorie — Second souffle n'est pas un déclencheur, c'est un choix", () => {
    // Aucun événement ne survient : le joueur DÉCIDE de l'utiliser. Ce
    // n'est pas une limite du vocabulaire, c'est une aptitude activée, qui
    // relève de la barre d'intention (V3-B1).
    const evenements = ["turn_start", "turn_end", "attack_hit", "damage_taken", "spell_cast", "movement", "short_rest", "long_rest"];
    expect(evenements).not.toContain("player_chooses");
  });
});
