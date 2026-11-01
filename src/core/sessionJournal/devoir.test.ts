import { describe, expect, it } from "vitest";
import {
  JOURNAL_STATUSES,
  canCancelDevoir,
  canSubmitDevoir,
  canValidateDevoir,
  isPublishedStatus,
  mentionDevoir,
  parseJournalStatus,
  titreProvisoire,
} from "./devoir";

const devoir = (status: string, entityId: string | null = "e1") => ({ status: parseJournalStatus(status), assignedTo: "u1", entityId });

describe("états du devoir de journal (V3.1-150)", () => {
  it("connaît trois états, et refuse une valeur inconnue plutôt que de la deviner", () => {
    expect(JOURNAL_STATUSES).toEqual(["pending", "written", "validated"]);
    for (const s of JOURNAL_STATUSES) expect(parseJournalStatus(s)).toBe(s);
    expect(() => parseJournalStatus("done")).toThrow();
    expect(() => parseJournalStatus("")).toThrow();
  });

  it("un devoir est publié (dans le Livre) une fois rendu, validé ou non", () => {
    expect(isPublishedStatus("pending")).toBe(false);
    expect(isPublishedStatus("written")).toBe(true);
    expect(isPublishedStatus("validated")).toBe(true);
  });

  it("seule l'autrice rend son devoir, une seule fois, et seulement s'il a sa page", () => {
    expect(canSubmitDevoir(devoir("pending"), "u1")).toBe(true);
    expect(canSubmitDevoir(devoir("pending"), "u2")).toBe(false);
    expect(canSubmitDevoir(devoir("written"), "u1")).toBe(false);
    expect(canSubmitDevoir(devoir("validated"), "u1")).toBe(false);
    expect(canSubmitDevoir(devoir("pending", null), "u1")).toBe(false);
  });

  it("le MJ ne valide qu'un devoir rendu", () => {
    expect(canValidateDevoir("pending")).toBe(false);
    expect(canValidateDevoir("written")).toBe(true);
    expect(canValidateDevoir("validated")).toBe(false);
  });

  it("annuler n'est possible qu'avant le rendu : le rendu est définitif", () => {
    expect(canCancelDevoir("pending")).toBe(true);
    expect(canCancelDevoir("written")).toBe(false);
    expect(canCancelDevoir("validated")).toBe(false);
  });

  it("la mention de la barre : à rendre, puis rendu, puis plus rien une fois validé", () => {
    expect(mentionDevoir("pending")).toBe("a_rendre");
    expect(mentionDevoir("written")).toBe("rendu");
    expect(mentionDevoir("validated")).toBeNull();
  });

  it("le titre provisoire reprend la date en jeu", () => {
    expect(titreProvisoire("12 Mirtul 1492")).toBe("Journal · 12 Mirtul 1492");
    expect(titreProvisoire("  ")).toBe("Journal");
  });
});
