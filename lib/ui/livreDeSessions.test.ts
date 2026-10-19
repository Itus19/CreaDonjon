import { describe, expect, it } from "vitest";
import { derniereSeanceJouee, prochaineSeance, registre, seanceReelleDuDevoir, type DevoirLivre, type SeanceReelle } from "./livreDeSessions";

const s = (id: string, date: string): SeanceReelle => ({ id, scheduled_date: date, starts_at: "19:00:00", duration_minutes: 240 });
const SEANCES = [s("s1", "2026-09-19"), s("s2", "2026-09-26"), s("s3", "2026-10-03"), s("s4", "2026-10-24")];
const MAINTENANT = new Date("2026-10-10T12:00:00").getTime();

function devoir(id: string, created_at: string, status: "pending" | "written" = "pending"): DevoirLivre {
  return { id, status, assigned_to: "u1", created_at, written_at: null, entity_name: null, entity_slug: null };
}

describe("seanceReelleDuDevoir", () => {
  it("prend la séance la plus récente dont la date n'est pas après la création", () => {
    expect(seanceReelleDuDevoir("2026-09-27T08:00:00Z", SEANCES)?.id).toBe("s2");
  });
  it("accepte une séance le jour même de la création", () => {
    expect(seanceReelleDuDevoir("2026-09-26T23:00:00Z", SEANCES)?.id).toBe("s2");
  });
  it("renvoie null si aucune séance n'est antérieure", () => {
    expect(seanceReelleDuDevoir("2026-09-01T00:00:00Z", SEANCES)).toBeNull();
  });
  it("compare le jour LOCAL de la création (les dates de séance sont locales) : un devoir posé tard le soir reste sur sa séance", () => {
    const tardLeSoir = new Date(2026, 8, 26, 23, 30).toISOString();
    expect(seanceReelleDuDevoir(tardLeSoir, SEANCES)?.id).toBe("s2");
    const toutDebutDeJournee = new Date(2026, 8, 26, 0, 15).toISOString();
    expect(seanceReelleDuDevoir(toutDebutDeJournee, SEANCES)?.id).toBe("s2");
  });
  it("ne dépend pas de l'ordre de la liste", () => {
    expect(seanceReelleDuDevoir("2026-10-05T00:00:00Z", [...SEANCES].reverse())?.id).toBe("s3");
  });
});

describe("prochaineSeance et derniereSeanceJouee", () => {
  it("distinguent passé et futur", () => {
    expect(prochaineSeance(SEANCES, MAINTENANT)?.id).toBe("s4");
    expect(derniereSeanceJouee(SEANCES, MAINTENANT)?.id).toBe("s3");
  });
  it("renvoient null sans séance concernée", () => {
    expect(prochaineSeance([], MAINTENANT)).toBeNull();
    expect(derniereSeanceJouee([SEANCES[3]], MAINTENANT)).toBeNull();
  });
});

describe("registre", () => {
  it("ajoute une ligne « sans devoir » par séance passée non couverte", () => {
    const lignes = registre([devoir("d1", "2026-09-27T08:00:00Z", "written")], SEANCES, MAINTENANT);
    const sans = lignes.filter((l) => l.etat === "sans_devoir").map((l) => l.seance?.id);
    expect(sans.sort()).toEqual(["s1", "s3"]);
    expect(lignes.find((l) => l.devoir?.id === "d1")?.etat).toBe("redigee");
  });
  it("ne compte pas une séance à venir", () => {
    expect(registre([], SEANCES, MAINTENANT).some((l) => l.seance?.id === "s4")).toBe(false);
  });
  it("marque un devoir en attente", () => {
    expect(registre([devoir("d1", "2026-10-04T08:00:00Z")], SEANCES, MAINTENANT).find((l) => l.devoir)?.etat).toBe("attente");
  });
  it("trie du plus récent au plus ancien", () => {
    const lignes = registre([devoir("d1", "2026-09-27T08:00:00Z")], SEANCES, MAINTENANT);
    expect(lignes.map((l) => l.cle)).toEqual(["seance-s3", "devoir-d1", "seance-s1"]);
  });
  it("garde un devoir sans séance réelle", () => {
    const lignes = registre([devoir("d1", "2026-01-01T00:00:00Z")], [], MAINTENANT);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].seance).toBeNull();
  });
});
