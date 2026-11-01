import { describe, expect, it } from "vitest";
import { canChangeEntityKind, isSystemKind, SESSION_JOURNAL_KIND, SYSTEM_KINDS } from "./systemKinds";
import { SHARED_NOTE_KIND } from "../notebook/share";
import { WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";

describe("types système d'une fiche", () => {
  it("les trois types système sont reconnus, aucun type du wiki ni catégorie personnelle", () => {
    expect([...SYSTEM_KINDS].sort()).toEqual([SESSION_JOURNAL_KIND, SHARED_NOTE_KIND, WORLD_TIMELINE_KIND].sort());
    for (const kind of SYSTEM_KINDS) expect(isSystemKind(kind)).toBe(true);
    for (const kind of ["character", "location", "faction", "Taverne", "session journal", "Session_journal"]) expect(isSystemKind(kind)).toBe(false);
  });

  it("garder le même type est toujours permis, même système (renommer une entrée du Livre)", () => {
    expect(canChangeEntityKind(SESSION_JOURNAL_KIND, SESSION_JOURNAL_KIND)).toBe(true);
    expect(canChangeEntityKind(SHARED_NOTE_KIND, SHARED_NOTE_KIND)).toBe(true);
    expect(canChangeEntityKind("location", "location")).toBe(true);
  });

  it("passer d'un type du wiki à un autre, ou à une catégorie personnelle, est permis", () => {
    expect(canChangeEntityKind("location", "faction")).toBe(true);
    expect(canChangeEntityKind("character", "Taverne")).toBe(true);
  });

  it("entrer dans un type système est refusé : la fiche y serait orpheline (ni sommaire, ni Livre)", () => {
    expect(canChangeEntityKind(SHARED_NOTE_KIND, SESSION_JOURNAL_KIND)).toBe(false);
    expect(canChangeEntityKind("location", SESSION_JOURNAL_KIND)).toBe(false);
    expect(canChangeEntityKind("character", SHARED_NOTE_KIND)).toBe(false);
    expect(canChangeEntityKind("faction", WORLD_TIMELINE_KIND)).toBe(false);
  });

  it("sortir d'un type système est refusé : le devoir ou le cahier qui la désigne perdrait sa fiche", () => {
    expect(canChangeEntityKind(SESSION_JOURNAL_KIND, "location")).toBe(false);
    expect(canChangeEntityKind(SHARED_NOTE_KIND, "character")).toBe(false);
    expect(canChangeEntityKind(WORLD_TIMELINE_KIND, SESSION_JOURNAL_KIND)).toBe(false);
  });
});
