import { describe, expect, it } from "vitest";
import { assistanceTexte, type PropositionIa } from "./assistanceTexte";

const enAttente: PropositionIa = {
  id: "p1",
  status: "pending",
  payload: { blockId: "bloc-a", text: "Le village vit de la peche." },
  validationErrors: null,
};

const rejetee: PropositionIa = {
  id: "p2",
  status: "rejected",
  payload: { blockId: "bloc-a" },
  validationErrors: { reason: "budget_exceeded" },
};

const autreBloc: PropositionIa = {
  id: "p3",
  status: "pending",
  payload: { blockId: "bloc-b", text: "Rien a voir." },
  validationErrors: null,
};

const base = {
  masquee: false,
  blockId: "bloc-a",
  propositions: [enAttente, rejetee, autreBloc],
  budgetRestant: 12,
  consigne: "Decris l'ambiance.",
  enCours: false,
};

describe("assistanceTexte", () => {
  it("ne laisse RIEN dans la coquille joueur, pas meme une proposition en attente", () => {
    const vu = assistanceTexte({ ...base, masquee: true });
    expect(vu).toEqual({ encart: false, enAttente: [], rejetees: [], peutProposer: false });
  });

  it("ne garde que les propositions de ce bloc", () => {
    const vu = assistanceTexte(base);
    expect(vu.enAttente.map((p) => p.id)).toEqual(["p1"]);
    expect(vu.rejetees.map((p) => p.id)).toEqual(["p2"]);
  });

  /**
   * Regle 9 cote interface : une proposition en attente est rendue A COTE de
   * la donnee du bloc. Cette fonction n'a aucune voie pour la fondre dans les
   * segments — elle rend des propositions, et le composant les affiche hors
   * de l'editeur. Le bloc n'est ecrit que par « Accepter ».
   */
  it("rend la proposition telle quelle, sans jamais la melanger aux segments", () => {
    const vu = assistanceTexte(base);
    expect(vu.enAttente[0]).toBe(enAttente);
    expect(vu.enAttente[0].payload.text).toBe("Le village vit de la peche.");
  });

  it("interdit de proposer sans consigne", () => {
    expect(assistanceTexte({ ...base, consigne: "   " }).peutProposer).toBe(false);
  });

  it("interdit de proposer pendant un appel en vol", () => {
    expect(assistanceTexte({ ...base, enCours: true }).peutProposer).toBe(false);
  });

  it("interdit de proposer quand le budget de l'heure est epuise", () => {
    expect(assistanceTexte({ ...base, budgetRestant: 0 }).peutProposer).toBe(false);
  });

  it("autorise de proposer quand le budget n'a pas encore ete lu", () => {
    expect(assistanceTexte({ ...base, budgetRestant: null }).peutProposer).toBe(true);
  });
});
