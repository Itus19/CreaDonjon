import { describe, expect, it } from "vitest";
import {
  appliquerSignalReaction,
  compteReactions,
  fenetresAReprendre,
  fenetresDepuisLignes,
  fenetresAffichees,
  lignesARepondre,
  type EtatReactions,
  type FenetreReaction,
  separerFenetres,
} from "./reactions";

function fenetre(sur: Partial<FenetreReaction> = {}): FenetreReaction {
  return {
    id: "w1",
    label: "Gobelin attaque Lia : 17",
    view: { total: 17, natural: 12, outcome: "touché" },
    choices: [
      { user_id: "lia", actor_label: "Lia", rule_key: "esquive", activation_id: "a", label: "Esquive instinctive", changes_outcome: true },
      { user_id: null, actor_label: "Orc", rule_key: "parade", activation_id: "b", label: "Parade", changes_outcome: null },
    ],
    answers: {},
    status: "pending",
    author_user_id: "mj",
    resumed_at: null,
    created_at: "2026-11-07T10:00:00Z",
    ...sur,
  };
}

const VIDE: EtatReactions = { enAttente: [], fermees: [] };

describe("appliquerSignalReaction", () => {
  it("ajoute une fenêtre ouverte, dans l'ordre d'arrivée", () => {
    const a = appliquerSignalReaction(VIDE, { type: "INSERT", ligne: fenetre({ id: "w2", created_at: "2026-11-07T10:05:00Z" }) });
    const b = appliquerSignalReaction(a, { type: "INSERT", ligne: fenetre({ id: "w1" }) });
    expect(b.enAttente.map((f) => f.id)).toEqual(["w1", "w2"]);
  });

  it("met à jour une fenêtre déjà connue sans la doubler", () => {
    const a = appliquerSignalReaction(VIDE, { type: "INSERT", ligne: fenetre() });
    const b = appliquerSignalReaction(a, { type: "UPDATE", ligne: fenetre({ answers: { "0": { use: true } } }) });
    expect(b.enAttente).toHaveLength(1);
    expect(b.enAttente[0].answers).toEqual({ "0": { use: true } });
  });

  it("une fenêtre fermée quitte la liste et attend sa reprise", () => {
    const a = appliquerSignalReaction(VIDE, { type: "INSERT", ligne: fenetre() });
    const b = appliquerSignalReaction(a, { type: "UPDATE", ligne: fenetre({ status: "closed", resumed_at: null }) });
    expect(b.enAttente).toEqual([]);
    expect(b.fermees.map((f) => f.id)).toEqual(["w1"]);
  });

  it("une fenêtre reprise n'attend plus rien", () => {
    const a = appliquerSignalReaction(VIDE, { type: "UPDATE", ligne: fenetre({ status: "closed" }) });
    const b = appliquerSignalReaction(a, { type: "UPDATE", ligne: fenetre({ status: "closed", resumed_at: "2026-11-07T10:01:00Z" }) });
    expect(b.fermees).toEqual([]);
  });

  it("retire à la suppression", () => {
    const a = appliquerSignalReaction(VIDE, { type: "INSERT", ligne: fenetre() });
    expect(appliquerSignalReaction(a, { type: "DELETE", id: "w1" }).enAttente).toEqual([]);
  });

  it("ignore une ligne illisible : l'état revient identique", () => {
    expect(appliquerSignalReaction(VIDE, { type: "INSERT", ligne: { id: 3 } })).toBe(VIDE);
  });
});

describe("lignesARepondre et compteReactions", () => {
  it("une joueuse a ses propres lignes, pas celles du MJ", () => {
    const l = lignesARepondre([fenetre()], { userId: "lia", isMj: false });
    expect(l.map((x) => [x.fenetreId, x.index])).toEqual([["w1", 0]]);
  });

  it("le MJ a les lignes sans joueuse (user_id null), pas celles d'une joueuse", () => {
    const l = lignesARepondre([fenetre()], { userId: "mj", isMj: true });
    expect(l.map((x) => x.index)).toEqual([1]);
  });

  it("une ligne déjà répondue n'est plus à répondre", () => {
    const f = fenetre({ answers: { "0": { use: false } } });
    expect(lignesARepondre([f], { userId: "lia", isMj: false })).toEqual([]);
    expect(compteReactions([f], { userId: "lia", isMj: false })).toBe(0);
  });

  it("sans utilisateur, rien", () => {
    expect(compteReactions([fenetre()], { userId: null, isMj: false })).toBe(0);
  });

  it("compte les lignes de toutes les fenêtres", () => {
    expect(compteReactions([fenetre(), fenetre({ id: "w2" })], { userId: "lia", isMj: false })).toBe(2);
  });
});

describe("fenetresAffichees", () => {
  it("une joueuse ne voit que les fenêtres où elle a à répondre", () => {
    const sans = fenetre({ id: "w2", choices: [{ ...fenetre().choices[0], user_id: "bob" }] });
    expect(fenetresAffichees([fenetre(), sans], { userId: "lia", isMj: false }).map((f) => f.id)).toEqual(["w1"]);
  });

  it("le MJ voit toutes les fenêtres ouvertes, pour pouvoir continuer", () => {
    const sans = fenetre({ id: "w2", choices: [{ ...fenetre().choices[0], user_id: "bob" }] });
    expect(fenetresAffichees([fenetre(), sans], { userId: "mj", isMj: true }).map((f) => f.id)).toEqual(["w1", "w2"]);
  });
});

describe("fenetresAReprendre", () => {
  it("ne garde que les fenêtres fermées de l'auteur, pas encore reprises", () => {
    const mienne = fenetre({ id: "m", status: "closed", author_user_id: "lia" });
    const autre = fenetre({ id: "a", status: "closed", author_user_id: "bob" });
    const reprise = fenetre({ id: "r", status: "closed", author_user_id: "lia", resumed_at: "2026-11-07T10:01:00Z" });
    expect(fenetresAReprendre([mienne, autre, reprise], "lia").map((f) => f.id)).toEqual(["m"]);
    expect(fenetresAReprendre([mienne], null)).toEqual([]);
  });
});

describe("fenetresDepuisLignes", () => {
  it("garde les lignes lisibles et écarte les autres", () => {
    expect(fenetresDepuisLignes([fenetre(), { id: 1 }]).map((f) => f.id)).toEqual(["w1"]);
  });
});

describe("separerFenetres (une reprise survit au rechargement)", () => {
  it("range les ouvertes et les fermées pas encore reprises ; une fermée reprise disparaît", () => {
    const r = separerFenetres([
      fenetre({ id: "a", status: "pending" }),
      fenetre({ id: "b", status: "closed", resumed_at: null }),
      fenetre({ id: "c", status: "closed", resumed_at: "2026-11-07T10:00:00Z" }),
    ]);
    expect(r.enAttente.map((f) => f.id)).toEqual(["a"]);
    expect(r.fermees.map((f) => f.id)).toEqual(["b"]);
  });
});
