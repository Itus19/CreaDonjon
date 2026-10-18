import { describe, expect, it } from "vitest";
import { aTraiter, compteurs, filtrerComptes, pourMemoire, tuileInitiale, type CompteAdmin } from "./administration";

function compte(id: string, nom: string, extra: Partial<CompteAdmin> = {}): CompteAdmin {
  return { id, handle_name: nom, must_change_password: false, password_reset_requested_at: null, ...extra };
}

describe("aTraiter", () => {
  it("garde les demandes, la plus récente en premier", () => {
    const comptes = [
      compte("a", "Ancienne", { password_reset_requested_at: "2026-10-17T08:00:00.000Z" }),
      compte("b", "Sans demande"),
      compte("c", "Récente", { password_reset_requested_at: "2026-10-18T08:00:00.000Z" }),
    ];
    expect(aTraiter(comptes).map((c) => c.id)).toEqual(["c", "a"]);
  });
});

describe("pourMemoire", () => {
  it("garde ceux qui doivent changer leur mot de passe sans demande en cours", () => {
    const comptes = [
      compte("a", "A", { must_change_password: true }),
      compte("b", "B", { must_change_password: true, password_reset_requested_at: "2026-10-18T08:00:00.000Z" }),
      compte("c", "C"),
    ];
    expect(pourMemoire(comptes).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("compteurs", () => {
  it("compte les demandes, les comptes et les liens", () => {
    const comptes = [compte("a", "A", { password_reset_requested_at: "2026-10-18T08:00:00.000Z" }), compte("b", "B", { must_change_password: true })];
    expect(compteurs(comptes, [{}, {}, {}])).toEqual({ aTraiter: 1, comptes: 2, liens: 3 });
  });
});

describe("tuileInitiale", () => {
  it("ouvre sur À traiter s'il y a quelque chose, sinon sur Comptes", () => {
    expect(tuileInitiale(2)).toBe("a_traiter");
    expect(tuileInitiale(0)).toBe("comptes");
  });
});

describe("filtrerComptes", () => {
  const comptes = [compte("a", "Noé"), compte("b", "Tamara"), compte("c", "ÉLODIE")];
  it("rend tout sans recherche", () => {
    expect(filtrerComptes(comptes, "  ")).toHaveLength(3);
  });
  it("ignore la casse et les accents", () => {
    expect(filtrerComptes(comptes, "noe").map((c) => c.id)).toEqual(["a"]);
    expect(filtrerComptes(comptes, "elodie").map((c) => c.id)).toEqual(["c"]);
    expect(filtrerComptes(comptes, "TAM").map((c) => c.id)).toEqual(["b"]);
  });
});
