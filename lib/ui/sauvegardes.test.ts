import { describe, expect, it } from "vitest";
import {
  appliquerSignal,
  compteDuDe,
  demandesARepondre,
  issueDeReponse,
  type DemandeSauvegarde,
  type EtatSauvegardes,
} from "./sauvegardes";

function demande(partiel: Partial<DemandeSauvegarde> & { id: string }): DemandeSauvegarde {
  return {
    label: "Moquerie cruelle — Sauvegarde SAG DD 13",
    ability: "wis",
    dc: 13,
    status: "pending",
    combat_id: "c1",
    target_id: "p1",
    target_entity_id: "e1",
    target_user_id: "joueuse",
    author_user_id: "mj",
    natural_roll: null,
    total: null,
    created_at: "2026-10-24T10:00:00Z",
    ...partiel,
  };
}

const VIDE: EtatSauvegardes = { enAttente: [], repondues: {} };

describe("appliquerSignal", () => {
  it("ajoute une demande en attente, sans doublon, dans l'ordre d'arrivée", () => {
    const a = demande({ id: "a", created_at: "2026-10-24T10:00:02Z" });
    const b = demande({ id: "b", created_at: "2026-10-24T10:00:01Z" });
    let etat = appliquerSignal(VIDE, { type: "INSERT", ligne: a });
    etat = appliquerSignal(etat, { type: "INSERT", ligne: b });
    etat = appliquerSignal(etat, { type: "INSERT", ligne: a });
    expect(etat.enAttente.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("une réponse retire la demande et garde son issue", () => {
    const a = demande({ id: "a" });
    const etat = appliquerSignal({ enAttente: [a], repondues: {} }, { type: "UPDATE", ligne: { ...a, status: "answered", natural_roll: 9, total: 10 } });
    expect(etat.enAttente).toEqual([]);
    expect(etat.repondues.a).toEqual({ total: 10, natural: 9, dc: 13, reussie: false });
  });

  it("une annulation retire la demande sans issue", () => {
    const a = demande({ id: "a" });
    const etat = appliquerSignal({ enAttente: [a], repondues: {} }, { type: "UPDATE", ligne: { ...a, status: "cancelled" } });
    expect(etat.enAttente).toEqual([]);
    expect(etat.repondues).toEqual({});
  });

  it("une suppression retire la demande par son identifiant", () => {
    const etat = appliquerSignal({ enAttente: [demande({ id: "a" })], repondues: {} }, { type: "DELETE", id: "a" });
    expect(etat.enAttente).toEqual([]);
  });

  it("une ligne d'une forme inattendue ne change rien", () => {
    const etat = appliquerSignal(VIDE, { type: "INSERT", ligne: { id: "x" } });
    expect(etat).toBe(VIDE);
  });
});

describe("issueDeReponse", () => {
  it("réussie à égalité avec le DD", () => {
    expect(issueDeReponse({ total: 13, natural_roll: 12, dc: 13 })).toEqual({ total: 13, natural: 12, dc: 13, reussie: true });
  });
  it("sans total, pas d'issue", () => {
    expect(issueDeReponse({ total: null, natural_roll: null, dc: 13 })).toBeNull();
  });
});

describe("demandesARepondre et compteDuDe", () => {
  const pourJoueuse = demande({ id: "a", target_user_id: "joueuse" });
  const pourAutre = demande({ id: "b", target_user_id: "autre" });
  const pourMj = demande({ id: "c", target_user_id: null });
  const liste = [pourJoueuse, pourAutre, pourMj];

  it("une joueuse ne voit que les siennes, moins celles laissées au MJ", () => {
    expect(demandesARepondre(liste, { userId: "joueuse", isMj: false, laisseesAuMj: new Set() }).map((d) => d.id)).toEqual(["a"]);
    expect(demandesARepondre(liste, { userId: "joueuse", isMj: false, laisseesAuMj: new Set(["a"]) })).toEqual([]);
  });

  it("le MJ les voit toutes : il peut répondre à chacune", () => {
    expect(demandesARepondre(liste, { userId: "mj", isMj: true, laisseesAuMj: new Set() }).map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("la pastille compte les demandes à répondre ; une joueuse sans compte n'en voit aucune", () => {
    expect(compteDuDe(liste, { userId: "mj", isMj: true, laisseesAuMj: new Set() })).toBe(3);
    expect(compteDuDe(liste, { userId: null, isMj: false, laisseesAuMj: new Set() })).toBe(0);
  });
});
