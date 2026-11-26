import { describe, expect, it } from "vitest";
import { worldToExport } from "./toWorldExport";
import { MONDE_ESSAI } from "./history/mondeEssai";
import { simulateHistory } from "./history/simulate";
import { zWorldExport } from "../schemas/worldExport";
import { validateBlockData } from "../schemas/blocks/registry";
import { WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";

describe("worldToExport", () => {
  const chronicle = simulateHistory(MONDE_ESSAI, { years: 300 });
  const exp = worldToExport(MONDE_ESSAI, { name: "Essai", chronicle });

  it("rend un fichier que l'import de monde accepte, blocs compris", () => {
    expect(() => zWorldExport.parse(exp)).not.toThrow();
    for (const b of exp.blocks) expect(() => validateBlockData(b.blockType, b.data)).not.toThrow();
  });

  it("crée une page de lieu par ville, avec son bloc Ville réservé au MJ", () => {
    const lieux = exp.entities.filter((e) => e.entityKind === "location");
    expect(lieux).toHaveLength(MONDE_ESSAI.sites.length);
    const hornver = lieux.find((e) => e.name === "Hornver");
    const bloc = exp.blocks.find((b) => b.entityRef === hornver?.ref && b.blockType === "settlement");
    const site = MONDE_ESSAI.sites.find((s) => s.name === "Hornver");
    expect(bloc).toMatchObject({ visibilityLevel: "gm", data: site?.settlement, display: { label: "Ville", layout: "key_values" } });
  });

  it("crée une faction par État et range chaque ville sous le sien", () => {
    const factions = exp.entities.filter((e) => e.entityKind === "faction");
    expect(factions.map((f) => f.name).sort()).toEqual(MONDE_ESSAI.states.map((s) => s.name).sort());
    const rattachees = MONDE_ESSAI.sites.filter((s) => s.stateId !== null);
    expect(exp.relations).toHaveLength(rattachees.length);
    for (const r of exp.relations) expect(r).toMatchObject({ relationType: "part_of", visibilityLevel: "gm" });
    const refs = new Set(exp.entities.map((e) => e.ref));
    for (const r of exp.relations) expect(refs.has(r.sourceRef) && refs.has(r.targetRef)).toBe(true);
  });

  it("écrit la chronique dans la frise du monde, entrées réservées au MJ", () => {
    const frise = exp.entities.filter((e) => e.entityKind === WORLD_TIMELINE_KIND);
    expect(frise).toHaveLength(1);
    const bloc = exp.blocks.find((b) => b.entityRef === frise[0]?.ref);
    expect(bloc?.blockType).toBe("timeline");
    const data = bloc?.data as { entries: { visibility: { level: string } }[] };
    expect(data.entries).toHaveLength(chronicle.events.length);
    for (const e of data.entries) expect(e.visibility.level).toBe("gm");
  });

  it("sans chronique, ne crée pas de frise", () => {
    const sans = worldToExport(MONDE_ESSAI, { name: "Essai", chronicle: null });
    expect(sans.entities.some((e) => e.entityKind === WORLD_TIMELINE_KIND)).toBe(false);
  });

  it("donne des références uniques et stables d'un appel à l'autre", () => {
    const refs = exp.entities.map((e) => e.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(worldToExport(MONDE_ESSAI, { name: "Essai", chronicle }).entities.map((e) => e.ref)).toEqual(refs);
  });

  it("refuse un nom de monde vide", () => {
    expect(() => worldToExport(MONDE_ESSAI, { name: "  ", chronicle: null })).toThrow(RangeError);
  });
});
