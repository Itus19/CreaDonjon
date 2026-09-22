import { describe, expect, it } from "vitest";
import { interpretIntent, type IntentCatalog } from "./intent";

/**
 * Catalogue de reference : Bram, une epee longue et une dague equipees,
 * deux competences, un gobelin et un allie presents. Les `terms` sont ce
 * qu'un joueur ECRIT, jamais des identifiants — c'est tout l'objet du
 * module.
 */
const CATALOG: IntentCatalog = {
  actions: [
    { id: "item-epee", kind: "weapon_attack", label: "Épée longue", terms: ["épée longue", "épée"] },
    { id: "item-dague", kind: "weapon_attack", label: "Dague", terms: ["dague"] },
    { id: "investigation", kind: "skill_check", label: "Investigation", terms: ["investigation"] },
    { id: "persuasion", kind: "skill_check", label: "Persuasion", terms: ["persuasion"] },
    { id: "dex", kind: "saving_throw", label: "Sauvegarde de Dextérité", terms: ["sauvegarde de dextérité"] },
  ],
  targets: [
    { id: "gob-2", label: "Gobelin 2", terms: ["gobelin 2", "gobelin"] },
    { id: "grelin", label: "Grelin", terms: ["grelin", "le tavernier"] },
  ],
  verbs: [
    { terms: ["frappe", "frapper", "attaque", "attaquer"], kind: "weapon_attack" },
    { terms: ["fouille", "fouiller"], kind: "skill_check", actionId: "investigation" },
    { terms: ["persuade", "persuader"], kind: "skill_check", actionId: "persuasion" },
    { terms: ["esquive", "esquiver"], kind: "saving_throw", actionId: "dex" },
    { terms: ["escalade", "escalader"], kind: "skill_check", actionId: "athletisme" },
  ],
};

describe("l'exemple du ticket, mot pour mot", () => {
  it("lit « je frappe le gobelin avec mon épée » comme une attaque à l'épée sur le gobelin", () => {
    const proposal = interpretIntent("je frappe le gobelin avec mon épée", CATALOG);

    expect(proposal.kind).toBe("mechanical");
    if (proposal.kind !== "mechanical") return;
    expect(proposal.actionKind).toBe("weapon_attack");
    expect(proposal.action.id).toBe("item-epee");
    expect(proposal.target?.id).toBe("gob-2");
    // Ce que l'ecran affiche pour dire ce qu'il a COMPRIS, avant de lancer.
    expect(proposal.matched).toEqual({ verb: "frappe", action: "épée", target: "gobelin" });
  });
});

describe("ce qui est nomme l'emporte sur ce qui est devine", () => {
  it("prend l'arme nommee, pas la premiere du catalogue", () => {
    const proposal = interpretIntent("j'attaque Grelin avec ma dague", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.action.id).toBe("item-dague");
  });

  it("sans arme nommee, prend la premiere du catalogue — jamais au hasard", () => {
    const first = interpretIntent("je frappe le gobelin", CATALOG);
    const second = interpretIntent("je frappe le gobelin", CATALOG);
    expect(first.kind === "mechanical" && first.action.id).toBe("item-epee");
    expect(second).toEqual(first);
  });

  it("choisit la correspondance la plus longue : « épée longue » n'est pas « épée »", () => {
    const proposal = interpretIntent("je frappe avec mon épée longue", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.matched.action).toBe("épée longue");
  });

  it("un verbe qui designe SA competence l'impose", () => {
    const proposal = interpretIntent("je fouille la piece", CATALOG);
    expect(proposal.kind).toBe("mechanical");
    if (proposal.kind !== "mechanical") return;
    expect(proposal.actionKind).toBe("skill_check");
    expect(proposal.action.id).toBe("investigation");
    expect(proposal.target).toBeNull();
  });

  it("une action nommee sans verbe suffit", () => {
    const proposal = interpretIntent("persuasion", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.action.id).toBe("persuasion");
    expect(proposal.kind === "mechanical" && proposal.matched.verb).toBeNull();
  });

  it("un verbe d'une famille ne va jamais chercher une action d'une autre", () => {
    // « frapper » est une attaque : « investigation » ecrit a cote ne doit
    // pas devenir l'action proposee.
    const proposal = interpretIntent("je frappe, investigation", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.action.id).toBe("item-epee");
  });
});

describe("la casse et les accents ne changent rien", () => {
  it("reconnait EPEE, Épée et epee", () => {
    for (const written of ["EPEE", "Épée", "epee"]) {
      const proposal = interpretIntent(`je frappe le gobelin avec mon ${written}`, CATALOG);
      expect(proposal.kind === "mechanical" && proposal.action.id).toBe("item-epee");
    }
  });
});

describe("les cibles", () => {
  it("reconnait un alias de cible", () => {
    const proposal = interpretIntent("je persuade le tavernier", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.target?.id).toBe("grelin");
  });

  it("prend la cible la plus precise quand deux termes se chevauchent", () => {
    // « gobelin 2 » contient « gobelin » : la plus longue gagne, et elle
    // designe le MEME present ici — le test verifie surtout le texte
    // rapporte, que l'ecran affiche.
    const proposal = interpretIntent("j'attaque le gobelin 2", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.matched.target).toBe("gobelin 2");
  });

  it("laisse la cible vide quand personne n'est nomme — jamais une cible devinee", () => {
    const proposal = interpretIntent("je frappe", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.target).toBeNull();
  });
});

describe("l'action libre est une sortie EXPLICITE, jamais un contournement", () => {
  it("rend une action libre quand rien n'est reconnu, et garde le texte", () => {
    const proposal = interpretIntent("je regarde autour de moi", CATALOG);
    expect(proposal).toEqual({
      kind: "free",
      text: "je regarde autour de moi",
      reason: "aucun_verbe_reconnu",
    });
  });

  it("rend une action libre sur un texte vide", () => {
    expect(interpretIntent("   ", CATALOG).kind).toBe("free");
  });

  it("dit QUELLE action manquait quand le verbe, lui, etait compris", () => {
    // « escalader » designe l'athletisme, absent de ce catalogue (le
    // personnage n'a pas cette competence). Tomber en action libre en
    // SILENCE cacherait la vraie raison a l'ecran.
    const proposal = interpretIntent("j'escalade le mur", CATALOG);
    expect(proposal).toEqual({
      kind: "free",
      text: "j'escalade le mur",
      reason: "aucune_action_disponible",
      wantedKind: "skill_check",
    });
  });

  it("rend une action libre quand la famille reconnue n'a aucune action — pas d'arme equipee", () => {
    const sansArme: IntentCatalog = { ...CATALOG, actions: CATALOG.actions.filter((a) => a.kind !== "weapon_attack") };
    const proposal = interpretIntent("je frappe le gobelin", sansArme);
    expect(proposal.kind).toBe("free");
    if (proposal.kind !== "free") return;
    expect(proposal.reason).toBe("aucune_action_disponible");
    expect(proposal.wantedKind).toBe("weapon_attack");
  });
});

describe("le premier verbe du texte decide", () => {
  it("retient le verbe le plus a gauche, pas le dernier", () => {
    // Deux lectures sont plausibles ; le moteur en choisit une, toujours la
    // meme, et l'ecran laisse corriger. Ce qu'il ne fait jamais : tirer au
    // sort entre les deux.
    const proposal = interpretIntent("je fouille la piece puis je frappe le gobelin", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.action.id).toBe("investigation");
  });
});

describe("le module ne resout rien", () => {
  it("ne rend aucun nombre : ni jet, ni total, ni degats", () => {
    const proposal = interpretIntent("je frappe le gobelin avec mon épée", CATALOG);
    // Une proposition est une LECTURE de la phrase. Le moindre nombre ici
    // signifierait qu'un de a ete lance hors du serveur de jeu.
    expect(JSON.stringify(proposal)).not.toMatch(/\bd20\b|total|damage|degats/i);
  });
});
