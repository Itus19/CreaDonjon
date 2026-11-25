import { describe, expect, it } from "vitest";
import {
  ELAPSED_CHOICES,
  MAX_PROPOSED_MINUTES,
  dureeExplicite,
  minutesDeParole,
  minutesJusquAuMatin,
  minutesProposees,
  phraseDuree,
} from "./elapsed";

describe("dureeExplicite — le moteur lit la durée que le joueur écrit", () => {
  it("en lettres ou en chiffres, au singulier ou au pluriel", () => {
    expect(dureeExplicite("Ok alors je fais ces trois heures de travail")).toEqual({ kind: "minutes", minutes: 180 });
    expect(dureeExplicite("je dors 8 heures")).toEqual({ kind: "minutes", minutes: 480 });
    expect(dureeExplicite("je marche 2 h vers le nord")).toEqual({ kind: "minutes", minutes: 120 });
    expect(dureeExplicite("j'attends une heure")).toEqual({ kind: "minutes", minutes: 60 });
    expect(dureeExplicite("je fouille pendant vingt minutes")).toEqual({ kind: "minutes", minutes: 20 });
    expect(dureeExplicite("je lis 45 min")).toEqual({ kind: "minutes", minutes: 45 });
  });

  it("les fractions d'heure usuelles", () => {
    expect(dureeExplicite("je patiente une demi-heure")).toEqual({ kind: "minutes", minutes: 30 });
    expect(dureeExplicite("un quart d'heure plus tard je reviens")).toEqual({ kind: "minutes", minutes: 15 });
    expect(dureeExplicite("je travaille deux heures et demie")).toEqual({ kind: "minutes", minutes: 150 });
  });

  it("jusqu'au matin, toute la nuit, jusqu'à l'aube", () => {
    expect(dureeExplicite("je dors jusqu'au matin")).toEqual({ kind: "until_morning" });
    expect(dureeExplicite("je veille toute la nuit")).toEqual({ kind: "until_morning" });
    expect(dureeExplicite("j'attends jusqu'à l'aube")).toEqual({ kind: "until_morning" });
  });

  it("sans durée, ou avec une heure du jour plutôt qu'une durée : rien", () => {
    expect(dureeExplicite("je lui demande combien de temps")).toBeNull();
    expect(dureeExplicite("je frappe le gobelin")).toBeNull();
    expect(dureeExplicite("rendez-vous à 8 h")).toBeNull();
    expect(dureeExplicite("rendez-vous à huit heures")).toBeNull();
  });

  it("plafonnée à une journée : une faute de frappe ne fait pas vieillir la partie d'un an", () => {
    expect(dureeExplicite("je dors 300 heures")).toEqual({ kind: "minutes", minutes: 24 * 60 });
  });
});

describe("minutesJusquAuMatin", () => {
  it("le soir : jusqu'à 7 h le lendemain", () => {
    expect(minutesJusquAuMatin({ day: 1, hour: 22, minute: 54 })).toBe(8 * 60 + 6);
  });
  it("avant l'aube : jusqu'à 7 h le jour même", () => {
    expect(minutesJusquAuMatin({ day: 2, hour: 3, minute: 0 })).toBe(4 * 60);
  });
  it("déjà le matin ou la journée : jusqu'au lendemain 7 h", () => {
    expect(minutesJusquAuMatin({ day: 2, hour: 7, minute: 0 })).toBe(24 * 60);
  });
});

describe("minutesProposees — le moteur valide la durée proposée par l'IA", () => {
  const soir = { day: 1, hour: 20, minute: 0 };
  it("chaque choix fermé a sa durée", () => {
    expect(minutesProposees({ kind: "instant" }, soir, false)).toBe(0);
    expect(minutesProposees({ kind: "quelques_minutes" }, soir, false)).toBe(5);
    expect(minutesProposees({ kind: "une_heure" }, soir, false)).toBe(60);
    expect(minutesProposees({ kind: "plusieurs_heures", hours: 3 }, soir, false)).toBe(180);
    expect(minutesProposees({ kind: "jusqu_au_matin" }, soir, false)).toBe(11 * 60);
  });
  it("plusieurs heures : de 2 à 8, jamais plus", () => {
    expect(minutesProposees({ kind: "plusieurs_heures", hours: 30 }, soir, false)).toBe(MAX_PROPOSED_MINUTES);
    expect(minutesProposees({ kind: "plusieurs_heures", hours: 1 }, soir, false)).toBe(120);
  });
  it("aucune ellipse en combat", () => {
    expect(minutesProposees({ kind: "une_heure" }, soir, true)).toBe(0);
  });
  it("la liste fermée est exposée pour l'outil", () => {
    expect(ELAPSED_CHOICES).toContain("jusqu_au_matin");
  });
});

describe("minutesDeParole", () => {
  it("au moins deux minutes, plus une par tranche de cent mots", () => {
    expect(minutesDeParole(10)).toBe(2);
    expect(minutesDeParole(99)).toBe(2);
    expect(minutesDeParole(100)).toBe(3);
    expect(minutesDeParole(250)).toBe(4);
  });
});

describe("phraseDuree — le fait que la narration reçoit", () => {
  it("dit la durée et l'heure atteinte", () => {
    expect(phraseDuree(180, { day: 1, hour: 22, minute: 54 })).toBe("3 h passent. Il est maintenant 22h54 (jour 1).");
    expect(phraseDuree(30, { day: 2, hour: 7, minute: 5 })).toBe("30 min passent. Il est maintenant 07h05 (jour 2).");
    expect(phraseDuree(150, { day: 2, hour: 7, minute: 5 })).toBe("2 h 30 passent. Il est maintenant 07h05 (jour 2).");
  });
});
