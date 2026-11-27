import { describe, expect, it } from "vitest";
import { worldToExport } from "./toWorldExport";
import { MONDE_ESSAI } from "./history/mondeEssai";
import { simulateHistory } from "./history/simulate";
import { zWorldExport } from "../schemas/worldExport";
import { validateBlockData } from "../schemas/blocks/registry";
import { WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";
import { zGeneratedWorldBlockData } from "../schemas/blocks/generatedWorld";
import { remapEntityIds } from "../linker/remapEntityIds";

describe("worldToExport", () => {
  const chronicle = simulateHistory(MONDE_ESSAI, { years: 300 });
  const exp = worldToExport(MONDE_ESSAI, { name: "Essai", chronicle });

  it("rend un fichier que l'import de monde accepte, blocs compris", () => {
    expect(() => zWorldExport.parse(exp)).not.toThrow();
    for (const b of exp.blocks) expect(() => validateBlockData(b.blockType, b.data)).not.toThrow();
  });

  it("crée une page de lieu par ville notable seulement, avec son bloc Ville réservé au MJ", () => {
    const lieux = exp.entities.filter((e) => e.entityKind === "location");
    expect(lieux.map((l) => l.name).sort()).toEqual(["Berton", "Hornver", "Ostral"]);
    const hornver = lieux.find((e) => e.name === "Hornver");
    const bloc = exp.blocks.find((b) => b.entityRef === hornver?.ref && b.blockType === "settlement");
    const site = MONDE_ESSAI.sites.find((s) => s.name === "Hornver");
    expect(bloc).toMatchObject({ visibilityLevel: "gm", data: { ...site?.settlement, siteId: "v-hornver" }, display: { label: "Ville", layout: "key_values" } });
  });

  it("crée une faction par État et range chaque ville sous le sien", () => {
    const factions = exp.entities.filter((e) => e.entityKind === "faction");
    expect(factions.map((f) => f.name).sort()).toEqual(MONDE_ESSAI.states.map((s) => s.name).sort());
    const rattachees = MONDE_ESSAI.sites.filter((s) => s.notable && s.stateId !== null);
    expect(exp.relations).toHaveLength(rattachees.length);
    for (const r of exp.relations) expect(r).toMatchObject({ relationType: "part_of", visibilityLevel: "gm" });
    const refs = new Set(exp.entities.map((e) => e.ref));
    for (const r of exp.relations) expect(refs.has(r.sourceRef) && refs.has(r.targetRef)).toBe(true);
  });

  it("écrit la chronique dans la frise du monde, entrées réservées au MJ", () => {
    const frise = exp.entities.filter((e) => e.entityKind === WORLD_TIMELINE_KIND);
    expect(frise).toHaveLength(1);
    const bloc = exp.blocks.find((b) => b.entityRef === frise[0]?.ref && b.blockType === "timeline");
    expect(bloc).toBeDefined();
    const data = bloc?.data as { entries: { visibility: { level: string } }[] };
    expect(data.entries).toHaveLength(chronicle.events.length);
    for (const e of data.entries) expect(e.visibility.level).toBe("gm");
  });

  it("garde la carte entière sur la frise, réservée au MJ, avec les pages déjà créées", () => {
    const frise = exp.entities.find((e) => e.entityKind === WORLD_TIMELINE_KIND);
    const bloc = exp.blocks.find((b) => b.blockType === "generated_world");
    expect(bloc).toMatchObject({ entityRef: frise?.ref, visibilityLevel: "gm" });
    const data = zGeneratedWorldBlockData.parse(bloc?.data);
    expect(data.world.sites).toHaveLength(MONDE_ESSAI.sites.length);
    const hornver = exp.entities.find((e) => e.name === "Hornver");
    expect(data.places).toContainEqual({ siteId: "v-hornver", entity: { kind: "entity", id: hornver?.ref } });
    expect(data.places.map((p) => p.siteId)).not.toContain("v-pellemont");
    const grania = exp.entities.find((e) => e.name === "Grania");
    expect(data.factions).toContainEqual({ stateId: "s-grania", entity: { kind: "entity", id: grania?.ref } });
  });

  it("recale les pages de la carte sur les fiches créées à l'import", () => {
    const idMap = new Map(exp.entities.map((e, k) => [e.ref, `uuid-${k}`]));
    const bloc = exp.blocks.find((b) => b.blockType === "generated_world");
    const recale = zGeneratedWorldBlockData.parse(remapEntityIds(bloc?.data, idMap));
    for (const p of recale.places) expect(p.entity.id).toMatch(/^uuid-/);
    for (const f of recale.factions) expect(f.entity.id).toMatch(/^uuid-/);
  });

  it("sans chronique, garde la carte mais n'écrit pas de frise", () => {
    const sans = worldToExport(MONDE_ESSAI, { name: "Essai", chronicle: null });
    expect(sans.blocks.some((b) => b.blockType === "timeline")).toBe(false);
    expect(sans.blocks.some((b) => b.blockType === "generated_world")).toBe(true);
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
