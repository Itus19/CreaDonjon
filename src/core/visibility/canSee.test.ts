import { describe, expect, it } from "vitest";
import { canSee } from "./canSee";
import { VisibilityScopeError } from "./errors";
import type { Viewer, VisibilitySubject } from "./types";

// ---------------------------------------------------------------------
// Six profils de lecteur, utilises pour la table de verite exhaustive.
// ---------------------------------------------------------------------
const CAMPAIGN_A = "campaign-a";
const CAMPAIGN_B = "campaign-b";
const PLAYER_A_ID = "user-player-a";

const anonymous: Viewer = { kind: "anonymous" };
const noLink: Viewer = { kind: "user", userId: "user-no-link", worldRole: null, campaignRoles: {} };
const playerInCampaign: Viewer = {
  kind: "user",
  userId: PLAYER_A_ID,
  worldRole: null,
  campaignRoles: { [CAMPAIGN_A]: "player" },
};
const playerInOtherCampaign: Viewer = {
  kind: "user",
  userId: "user-player-b",
  worldRole: null,
  campaignRoles: { [CAMPAIGN_B]: "player" },
};
const gmOfCampaign: Viewer = {
  kind: "user",
  userId: "user-gm",
  worldRole: null,
  campaignRoles: { [CAMPAIGN_A]: "gm" },
};
const worldOwner: Viewer = { kind: "user", userId: "user-owner", worldRole: "owner", campaignRoles: {} };

const ctxInCampaignA = { campaignId: CAMPAIGN_A };

// ---------------------------------------------------------------------
// Table de verite exhaustive : 6 niveaux x 6 profils. Un test par cas,
// comme demande par le ticket P0-03 — aucune boucle.
// ---------------------------------------------------------------------

describe("canSee — niveau public", () => {
  const subject: VisibilitySubject = { level: "public", scopeId: null, createdBy: null };

  it("anonyme voit du contenu public", () => {
    expect(canSee(subject, anonymous)).toBe(true);
  });
  it("utilisateur sans lien voit du contenu public", () => {
    expect(canSee(subject, noLink)).toBe(true);
  });
  it("joueur de la campagne voit du contenu public", () => {
    expect(canSee(subject, playerInCampaign, ctxInCampaignA)).toBe(true);
  });
  it("joueur d'une autre campagne voit du contenu public", () => {
    expect(canSee(subject, playerInOtherCampaign)).toBe(true);
  });
  it("MJ voit du contenu public", () => {
    expect(canSee(subject, gmOfCampaign, ctxInCampaignA)).toBe(true);
  });
  it("proprietaire du monde voit du contenu public", () => {
    expect(canSee(subject, worldOwner)).toBe(true);
  });
});

describe("canSee — niveau players", () => {
  const subject: VisibilitySubject = { level: "players", scopeId: null, createdBy: null };

  it("anonyme ne voit pas du contenu 'players'", () => {
    expect(canSee(subject, anonymous)).toBe(false);
  });
  it("utilisateur sans lien ne voit pas du contenu 'players'", () => {
    expect(canSee(subject, noLink)).toBe(false);
  });
  it("joueur de la campagne voit du contenu 'players'", () => {
    expect(canSee(subject, playerInCampaign, ctxInCampaignA)).toBe(true);
  });
  it("joueur d'une autre campagne voit du contenu 'players' (membre d'une campagne du monde)", () => {
    expect(canSee(subject, playerInOtherCampaign)).toBe(true);
  });
  it("MJ voit du contenu 'players'", () => {
    expect(canSee(subject, gmOfCampaign, ctxInCampaignA)).toBe(true);
  });
  it("proprietaire du monde voit du contenu 'players'", () => {
    expect(canSee(subject, worldOwner)).toBe(true);
  });
});

describe("canSee — niveau gm", () => {
  const subject: VisibilitySubject = { level: "gm", scopeId: null, createdBy: null };

  it("anonyme ne voit pas du contenu 'gm'", () => {
    expect(canSee(subject, anonymous)).toBe(false);
  });
  it("utilisateur sans lien ne voit pas du contenu 'gm'", () => {
    expect(canSee(subject, noLink)).toBe(false);
  });
  it("joueur de la campagne ne voit pas du contenu 'gm'", () => {
    expect(canSee(subject, playerInCampaign, ctxInCampaignA)).toBe(false);
  });
  it("joueur d'une autre campagne ne voit pas du contenu 'gm'", () => {
    expect(canSee(subject, playerInOtherCampaign)).toBe(false);
  });
  it("MJ voit du contenu 'gm'", () => {
    expect(canSee(subject, gmOfCampaign, ctxInCampaignA)).toBe(true);
  });
  it("proprietaire du monde voit du contenu 'gm'", () => {
    expect(canSee(subject, worldOwner)).toBe(true);
  });
});

describe("canSee — niveau campaign (scope = campagne A, contexte = campagne A)", () => {
  const subject: VisibilitySubject = { level: "campaign", scopeId: CAMPAIGN_A, createdBy: null };

  it("anonyme ne voit pas un secret de campagne", () => {
    expect(canSee(subject, anonymous, ctxInCampaignA)).toBe(false);
  });
  it("utilisateur sans lien ne voit pas un secret de campagne", () => {
    expect(canSee(subject, noLink, ctxInCampaignA)).toBe(false);
  });
  it("joueur de la campagne A voit son secret de campagne", () => {
    expect(canSee(subject, playerInCampaign, ctxInCampaignA)).toBe(true);
  });
  it("joueur de la campagne B ne voit pas le secret de la campagne A", () => {
    expect(canSee(subject, playerInOtherCampaign, ctxInCampaignA)).toBe(false);
  });
  it("MJ de la campagne A voit son secret de campagne", () => {
    expect(canSee(subject, gmOfCampaign, ctxInCampaignA)).toBe(true);
  });
  it("proprietaire du monde ne voit pas un secret d'une campagne dont il n'est pas membre", () => {
    expect(canSee(subject, worldOwner, ctxInCampaignA)).toBe(false);
  });

  it("un membre de la campagne A ne voit pas son propre secret hors du contexte de cette campagne", () => {
    expect(canSee(subject, playerInCampaign, {})).toBe(false);
    expect(canSee(subject, playerInCampaign, { campaignId: CAMPAIGN_B })).toBe(false);
  });
});

describe("canSee — niveau user (scope = l'utilisateur 'joueur de la campagne A')", () => {
  const subject: VisibilitySubject = { level: "user", scopeId: PLAYER_A_ID, createdBy: null };

  it("anonyme ne voit pas un contenu prive a un autre utilisateur", () => {
    expect(canSee(subject, anonymous)).toBe(false);
  });
  it("utilisateur sans lien ne voit pas le contenu d'un autre utilisateur", () => {
    expect(canSee(subject, noLink)).toBe(false);
  });
  it("l'utilisateur cible voit son propre contenu", () => {
    expect(canSee(subject, playerInCampaign, ctxInCampaignA)).toBe(true);
  });
  it("un autre joueur ne voit pas le contenu cible a quelqu'un d'autre", () => {
    expect(canSee(subject, playerInOtherCampaign)).toBe(false);
  });
  it("le MJ ne voit pas le contenu cible a un utilisateur precis s'il n'est pas lui", () => {
    expect(canSee(subject, gmOfCampaign, ctxInCampaignA)).toBe(false);
  });
  it("le proprietaire du monde ne voit pas le contenu cible a un utilisateur precis s'il n'est pas lui", () => {
    expect(canSee(subject, worldOwner)).toBe(false);
  });
});

describe("canSee — niveau private (auteur = 'joueur de la campagne A')", () => {
  const subject: VisibilitySubject = { level: "private", scopeId: null, createdBy: PLAYER_A_ID };

  it("anonyme ne voit pas un contenu prive", () => {
    expect(canSee(subject, anonymous)).toBe(false);
  });
  it("utilisateur sans lien ne voit pas un contenu prive d'un autre", () => {
    expect(canSee(subject, noLink)).toBe(false);
  });
  it("l'auteur voit son propre contenu prive", () => {
    expect(canSee(subject, playerInCampaign, ctxInCampaignA)).toBe(true);
  });
  it("un autre joueur ne voit pas le contenu prive d'autrui", () => {
    expect(canSee(subject, playerInOtherCampaign)).toBe(false);
  });
  it("le MJ ne voit pas le contenu prive d'un joueur", () => {
    expect(canSee(subject, gmOfCampaign, ctxInCampaignA)).toBe(false);
  });
  it("le proprietaire du monde ne voit pas le contenu prive d'un utilisateur, meme lui", () => {
    expect(canSee(subject, worldOwner)).toBe(false);
  });
});

describe("canSee — refus de deviner", () => {
  it("'campaign' sans scopeId leve une erreur au lieu de deviner", () => {
    const subject: VisibilitySubject = { level: "campaign", scopeId: null, createdBy: null };
    expect(() => canSee(subject, playerInCampaign, ctxInCampaignA)).toThrow(VisibilityScopeError);
  });

  it("'user' sans scopeId leve une erreur au lieu de deviner", () => {
    const subject: VisibilitySubject = { level: "user", scopeId: null, createdBy: null };
    expect(() => canSee(subject, playerInCampaign)).toThrow(VisibilityScopeError);
  });

  it("'private' sans createdBy est invisible a tout le monde plutot que de deviner un proprietaire", () => {
    const subject: VisibilitySubject = { level: "private", scopeId: null, createdBy: null };
    expect(canSee(subject, worldOwner)).toBe(false);
  });

  it("un niveau de visibilite invalide (donnee corrompue) leve une erreur plutot que de retourner silencieusement", () => {
    const corrupted = { level: "unknown_level", scopeId: null, createdBy: null } as unknown as VisibilitySubject;
    expect(() => canSee(corrupted, worldOwner)).toThrow(/Niveau de visibilite non gere/);
  });
});
