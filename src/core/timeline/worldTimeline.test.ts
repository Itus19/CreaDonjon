import { describe, expect, it } from "vitest";
import { defaultScopeForKind, resolveScope, lifeEventEntries, WORLD_TIMELINE_KIND } from "./worldTimeline";
import { isWikiHiddenKind } from "../entities/systemKinds";
import { zTimelineEntry, type TimelineEntry } from "../schemas/blocks/timeline";
import type { GameDate } from "../calendar/types";

const y = (year: number): GameDate => ({ year, month: null, day: null, precision: "year", end: null, label: null });

function entry(partial: Partial<TimelineEntry>): TimelineEntry {
  return zTimelineEntry.parse({ id: "e1", date: y(1400), kind: "custom", title: "Un fait", ...partial });
}

describe("la portée d'une entrée de chronologie (V3.1-96, ADR 0048)", () => {
  it("défaut par genre : guerre, catastrophe, fondation → monde", () => {
    for (const kind of ["war", "disaster", "founding"] as const) expect(defaultScopeForKind(kind)).toBe("major");
  });
  it("défaut par genre : bataille, découverte, serment, trahison → région", () => {
    for (const kind of ["battle", "discovery", "oath", "betrayal"] as const) expect(defaultScopeForKind(kind)).toBe("notable");
  });
  it("défaut par genre : naissance, mort, rencontre, et ce qui n'est pas classé → détail", () => {
    for (const kind of ["birth", "death", "meeting", "trauma", "custom"] as const) expect(defaultScopeForKind(kind)).toBe("detail");
  });
  it("une portée choisie prime sur le défaut", () => {
    expect(resolveScope(entry({ kind: "battle", scope: "major" }))).toBe("major");
    expect(resolveScope(entry({ kind: "battle" }))).toBe("notable");
  });
  it("une entrée écrite avant la portée se relit telle quelle (champ facultatif)", () => {
    const old = zTimelineEntry.parse({ id: "x", date: y(1300), kind: "war", title: "Ancienne" });
    expect(old.scope).toBeUndefined();
    expect(resolveScope(old)).toBe("major");
  });
  it("refuse une portée inconnue", () => {
    expect(zTimelineEntry.safeParse({ id: "x", date: y(1300), kind: "war", title: "T", scope: "cosmic" }).success).toBe(false);
  });
});

describe("naissances et morts d'une fiche, en entrées de frise", () => {
  it("une naissance et une mort, portée détail, avec la visibilité du bloc", () => {
    const entries = lifeEventEntries({ entityId: "ent-1", name: "Aldric", birth: y(1420), death: y(1478), visibility: { level: "players", scopeId: null } });
    expect(entries).toEqual([
      expect.objectContaining({ id: "birth:ent-1", kind: "birth", title: "Naissance d'Aldric", scope: "detail", date: y(1420), visibility: { level: "players", scopeId: null } }),
      expect.objectContaining({ id: "death:ent-1", kind: "death", title: "Mort d'Aldric", scope: "detail", date: y(1478) }),
    ]);
  });
  it("élision devant une consonne : « de Mira »", () => {
    expect(lifeEventEntries({ entityId: "e", name: "Mira", birth: y(1450), visibility: { level: "public", scopeId: null } })[0].title).toBe("Naissance de Mira");
  });
  it("sans dates : aucune entrée", () => {
    expect(lifeEventEntries({ entityId: "e", name: "Mira", visibility: { level: "public", scopeId: null } })).toEqual([]);
  });
});

describe("les fiches système cachées du wiki", () => {
  it("la Chronologie du monde et la page partagée du cahier ne sont pas des fiches du wiki", () => {
    expect(isWikiHiddenKind(WORLD_TIMELINE_KIND)).toBe(true);
    expect(isWikiHiddenKind("shared_note")).toBe(true);
    expect(isWikiHiddenKind("character")).toBe(false);
  });
});
