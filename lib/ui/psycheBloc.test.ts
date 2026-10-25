import { describe, expect, it } from "vitest";
import {
  annoncePrioritaires,
  appliquesParEvenement,
  avancerAjout,
  basculerPrioritaire,
  confirmationRequise,
  ecartApresPas,
  intensiteSuivante,
  poleVise,
  regrouperAspirations,
  tensionAffichee,
  type EtatAjout,
} from "./psycheBloc";

describe("basculerPrioritaire (★)", () => {
  it("ajoute dans l'ordre des clics", () => {
    expect(basculerPrioritaire([], "a")).toEqual(["a"]);
    expect(basculerPrioritaire(["a"], "b")).toEqual(["a", "b"]);
  });
  it("un troisième retire le plus ancien, et garde l'ordre", () => {
    expect(basculerPrioritaire(["a", "b"], "c")).toEqual(["b", "c"]);
    expect(basculerPrioritaire(["b", "c"], "a")).toEqual(["c", "a"]);
  });
  it("toucher une étoile posée la retire", () => {
    expect(basculerPrioritaire(["a", "b"], "a")).toEqual(["b"]);
    expect(basculerPrioritaire(["a"], "a")).toEqual([]);
  });
  it("n'a jamais plus de deux pôles", () => {
    let p: string[] = [];
    for (const k of ["a", "b", "c", "d", "e"]) p = basculerPrioritaire(p, k);
    expect(p).toEqual(["d", "e"]);
  });
});

describe("annoncePrioritaires", () => {
  const nom = (k: string) => k.toUpperCase();
  it("dit aucun, un, ou deux pôles dans l'ordre", () => {
    expect(annoncePrioritaires([], nom)).toEqual({ cle: "aucun" });
    expect(annoncePrioritaires(["a"], nom)).toEqual({ cle: "un", premier: "A" });
    expect(annoncePrioritaires(["a", "b"], nom)).toEqual({ cle: "deux", premier: "A", second: "B" });
  });
});

describe("confirmation au-delà de 40", () => {
  it("40 passe, 41 demande confirmation, dans les deux sens", () => {
    expect(confirmationRequise(40)).toBe(false);
    expect(confirmationRequise(-40)).toBe(false);
    expect(confirmationRequise(41)).toBe(true);
    expect(confirmationRequise(-41)).toBe(true);
  });

  const saisie: EtatAjout = { etape: "saisie" };

  it("un écart ordinaire s'écrit tout de suite", () => {
    expect(avancerAjout(saisie, { type: "ajouter", delta: 30 })).toEqual({ etat: saisie, ecrire: 30 });
  });

  it("un écart > 40 demande confirmation et n'écrit rien", () => {
    const r = avancerAjout(saisie, { type: "ajouter", delta: 50 });
    expect(r.ecrire).toBeNull();
    expect(r.etat).toEqual({ etape: "confirmation", delta: 50 });
  });

  it("confirmer écrit l'écart demandé", () => {
    const r = avancerAjout({ etape: "confirmation", delta: -60 }, { type: "confirmer" });
    expect(r).toEqual({ etat: saisie, ecrire: -60 });
  });

  it("refuser n'écrit rien et revient à la saisie", () => {
    const r = avancerAjout({ etape: "confirmation", delta: 50 }, { type: "annuler" });
    expect(r).toEqual({ etat: saisie, ecrire: null });
  });

  it("confirmer sans demande en cours n'écrit rien ; un écart nul non plus", () => {
    expect(avancerAjout(saisie, { type: "confirmer" }).ecrire).toBeNull();
    expect(avancerAjout(saisie, { type: "ajouter", delta: 0 }).ecrire).toBeNull();
  });
});

describe("écart par pas de 10", () => {
  it("monte, descend, et reste dans ±100", () => {
    expect(ecartApresPas(0, 1)).toBe(10);
    expect(ecartApresPas(0, -1)).toBe(-10);
    expect(ecartApresPas(100, 1)).toBe(100);
    expect(ecartApresPas(-95, -1)).toBe(-100);
  });
});

describe("aspirations par horizon", () => {
  it("range en trois colonnes en gardant l'ordre", () => {
    const g = regrouperAspirations([
      { id: "1", horizon: "session" as const },
      { id: "2", horizon: "life" as const },
      { id: "3", horizon: "session" as const },
    ]);
    expect(g.life.map((a) => a.id)).toEqual(["2"]);
    expect(g.arc).toEqual([]);
    expect(g.session.map((a) => a.id)).toEqual(["1", "3"]);
  });
  it("l'intensité passe à la suivante et reboucle", () => {
    expect(intensiteSuivante(1)).toBe(2);
    expect(intensiteSuivante(2)).toBe(3);
    expect(intensiteSuivante(3)).toBe(1);
  });
});

describe("appliquesParEvenement", () => {
  // Du plus récent au plus ancien, comme l'API.
  const evenements = [
    { id: "e2", created_at: "2026-01-02T00:00:00Z", deltas: { impulse_prudence: 20 } },
    { id: "e1", created_at: "2026-01-01T00:00:00Z", deltas: { impulse_prudence: 50 } },
  ];

  it("rejoue le journal avec l'amortissement : le brut et l'appliqué diffèrent", () => {
    // 0 +50 → 50 ; 50 +20 → 50 + 20 * (1 - 0.5) = 60 : appliqué +10 pour un brut +20.
    const r = appliquesParEvenement(evenements, { impulse_prudence: 60 }, true);
    expect(r.e1).toEqual({ impulse_prudence: 50 });
    expect(r.e2).toEqual({ impulse_prudence: 10 });
  });

  it("ne dit rien si l'historique est tronqué", () => {
    expect(appliquesParEvenement(evenements, { impulse_prudence: 60 }, false)).toEqual({});
  });

  it("ne dit rien d'un pôle dont le rejeu ne retombe pas sur la valeur actuelle", () => {
    const r = appliquesParEvenement(evenements, { impulse_prudence: 75 }, true);
    expect(r.e1.impulse_prudence).toBeUndefined();
    expect(r.e2.impulse_prudence).toBeUndefined();
  });
});

describe("tensionAffichee", () => {
  it("pas de phrase à 2 crans", () => {
    expect(tensionAffichee([{ key: "order_freedom", value: 80 }], [{ key: "order_freedom", value: 20 }])).toBeNull();
  });
  it("une phrase à 3 crans, sur l'axe le plus écarté", () => {
    const t = tensionAffichee(
      [
        { key: "order_freedom", value: 80 },
        { key: "peace_force", value: 0 },
      ],
      [
        { key: "order_freedom", value: 0 },
        { key: "peace_force", value: 0 },
      ],
    );
    expect(t).toMatchObject({ key: "order_freedom", gap: 3, tension: true });
  });
});

describe("poleVise", () => {
  const fin = { positive: { label: "Curiosité" }, negative: { label: "Circonspection" } };
  it("nomme le bout vers lequel l'écart pousse, sans nombre", () => {
    expect(poleVise(fin, 20)).toBe("Curiosité");
    expect(poleVise(fin, -5)).toBe("Circonspection");
  });
});
