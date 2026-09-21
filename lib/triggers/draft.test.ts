import { describe, expect, it } from "vitest";
import { zTrigger } from "@/src/core/rules/triggers";
import { draftToTrigger, emptyDraft, type TriggerDraft } from "./draft";

function draft(patch: Partial<TriggerDraft> = {}): TriggerDraft {
  return { ...emptyDraft(), ...patch };
}

/**
 * C'est la seule logique du formulaire qui puisse se tromper EN SILENCE :
 * une condition mal composee produit un declencheur que Zod accepte mais
 * qui ne part jamais. Aucun typage ne le verrait ; ces tests, si.
 */

describe("tout brouillon complet produit un declencheur VALIDE", () => {
  it("le resultat passe zTrigger, sinon l'import de la fiche echouerait", () => {
    const cas: TriggerDraft[] = [
      draft({ conditionKind: "etiquette", conditionKey: "skill:deception", effectText: "Il a vu le mensonge." }),
      draft({ conditionKind: "condition", conditionKey: "concentrating", effectText: "Tu vacilles." }),
      draft({ conditionKind: "donnee", conditionKey: "damage", conditionMin: "5", effectText: "Ça pique." }),
      draft({ conditionKind: "aucune", effectKind: "heal", effectAmount: "3" }),
      draft({ effectKind: "grant_budget", budgetKind: "bonus", effectAmount: "1" }),
      draft({ effectKind: "apply_condition", effectText: "prone" }),
    ];
    for (const d of cas) {
      const t = draftToTrigger(d, "essai");
      expect(t).not.toBeNull();
      expect(zTrigger.safeParse(t).success).toBe(true);
    }
  });
});

describe("les conditions", () => {
  it("« l'événement porte telle étiquette » interroge l'EVENEMENT, pas l'acteur", () => {
    const t = draftToTrigger(draft({ conditionKind: "etiquette", conditionKey: "skill:deception", effectText: "x" }), "a");
    expect(t?.if).toEqual({ op: "event_has", key: "skill:deception" });
  });

  it("« le sujet a telle condition » interroge l'ACTEUR", () => {
    const t = draftToTrigger(draft({ conditionKind: "condition", conditionKey: "concentrating", effectText: "x" }), "a");
    expect(t?.if).toEqual({ op: "has_condition", who: "self", key: "concentrating" });
  });

  it("prefixe `event.` tout seul — l'auteur n'a pas a connaitre cet encodage", () => {
    const t = draftToTrigger(draft({ conditionKind: "donnee", conditionKey: "damage", conditionMin: "5", effectText: "x" }), "a");
    expect(t?.if).toEqual({
      op: "gte",
      args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 5 }],
    });
  });

  it("ne double pas le prefixe si l'auteur l'a deja ecrit", () => {
    const t = draftToTrigger(draft({ conditionKind: "donnee", conditionKey: "event.damage", conditionMin: "1", effectText: "x" }), "a");
    expect(t?.if).toMatchObject({ args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 1 }] });
  });

  it("une clé laissee vide vaut « aucune condition », jamais une condition cassee", () => {
    // Sinon on produirait `has_condition` avec une cle vide : refuse par Zod,
    // et c'est tout l'import de la fiche qui tomberait.
    const t = draftToTrigger(draft({ conditionKind: "condition", conditionKey: "   ", effectText: "x" }), "a");
    expect(t?.if).toBeUndefined();
    expect(zTrigger.safeParse(t).success).toBe(true);
  });

  it("« aucune » ne pose pas de condition", () => {
    expect(draftToTrigger(draft({ conditionKind: "aucune", effectText: "x" }), "a")?.if).toBeUndefined();
  });
});

describe("les effets", () => {
  it("un montant negatif retire du budget — un seul effet pour les deux sens", () => {
    const t = draftToTrigger(draft({ effectKind: "grant_budget", budgetKind: "reaction", effectAmount: "-1" }), "a");
    expect(t?.then[0]).toEqual({
      action: "grant_budget",
      who: "self",
      kind: "reaction",
      amount: { op: "num", value: -1 },
    });
  });

  it("un montant illisible vaut zero plutot que NaN, qui casserait le schema", () => {
    const t = draftToTrigger(draft({ effectKind: "heal", effectAmount: "beaucoup" }), "a");
    expect(t?.then[0]).toMatchObject({ amount: { op: "num", value: 0 } });
  });
});

describe("un brouillon incomplet ne produit rien", () => {
  it("rend `null` quand l'effet textuel est vide", () => {
    // Une ligne vide oubliee ferait echouer TOUT l'import de la fiche.
    expect(draftToTrigger(draft({ effectKind: "narrate_hint", effectText: "  " }), "a")).toBeNull();
    expect(draftToTrigger(draft({ effectKind: "apply_condition", effectText: "" }), "a")).toBeNull();
  });

  it("mais un effet chiffre a zero reste un effet voulu", () => {
    expect(draftToTrigger(draft({ effectKind: "heal", effectAmount: "0" }), "a")).not.toBeNull();
  });
});
