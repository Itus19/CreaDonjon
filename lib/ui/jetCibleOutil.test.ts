import { afterEach, describe, expect, it, vi } from "vitest";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import { preReglageCible, type ParametresJetCible, type TextesJetCible } from "@/lib/ui/jetCibleOutil";

const textes: TextesJetCible = {
  libelle: (cle, cible) => `${cle} — ${cible}`,
  erreurJet: "Jet impossible",
  allie: "Allié",
  adversaire: "Adversaire",
  lancerDegats: (formule) => (formule ? `Lancer les dégâts · ${formule}` : "Lancer les dégâts"),
  validerDegats: "Valider · dégâts",
  faireEchouer: "Faire échouer",
  refusMj: "Raté (MJ) — aucun dégât",
};

function participant(id: string, label: string, estAllie: boolean): CombatParticipantRow {
  return { id, label, is_ally: estAllie, hp_max: 20, hp_current: 20, temp_hp: 0 } as unknown as CombatParticipantRow;
}

const participants = [participant("worg", "Worg", false), participant("leonie", "Léonie", true)];
const reponseTouche = (cibleId: string) => ({
  ok: true,
  verdict: "hit",
  amount: null,
  facts: [],
  changes: [],
  hints: [],
  ignored: [],
  targetOutOfFight: false,
  chained: { kind: "damage", actor: { kind: "participant", participantId: "worg" }, action: { kind: "monster_action", name: "Morsure" }, targetId: cibleId, critical: false },
  rollEventId: "r",
  saveRequestId: null,
  dice: { total: 17, trace: [{ text: "1d20 (12)", value: 12 }, { text: "+5", value: 5 }], pair: null, naturalD20: 12 },
});

function parametres(extra: Partial<ParametresJetCible>): ParametresJetCible {
  return {
    titre: "Morsure · Touche",
    titreDegats: "Morsure · Dégâts",
    kind: "attack",
    action: { kind: "monster_action", name: "Morsure" },
    acteur: { kind: "participant", participantId: "worg" },
    nomActeur: "Worg",
    formule: "1d6 + 2",
    modifier: 5,
    touche: true,
    participants,
    campaignId: "c",
    combatId: "k",
    textes,
    apresJet: () => {},
    ...extra,
  };
}

afterEach(() => vi.unstubAllGlobals());

function reponduPar(corps: unknown) {
  const fetchSimule = vi.fn(async () => new Response(JSON.stringify(corps), { status: 200 }));
  vi.stubGlobal("fetch", fetchSimule);
  return fetchSimule;
}

describe("preReglageCible", () => {
  it("liste les participants, avec leur camp", () => {
    const preset = preReglageCible(parametres({}));
    expect(preset.cibles?.map((c) => c.label)).toEqual(["Worg", "Léonie"]);
    expect(preset.cibles?.[1].info).toContain("Allié");
    expect(preset.avantageLibre).toBe(true);
    expect(preset.dice).toEqual({ d20: 1 });
  });

  it("une touche d'un monstre sur un adversaire propose directement les dégâts, avec la formule et les dés des dégâts", async () => {
    reponduPar(reponseTouche("worg"));
    const sortie = await preReglageCible(parametres({})).lancer?.("worg", { avantage: "normal" });
    expect(sortie?.suite?.libelle).toBe("Lancer les dégâts · 1d6 + 2");
    expect(sortie?.suite?.refus).toBeUndefined();
    expect(sortie?.suite?.preReglage?.label).toBe("Morsure · Dégâts");
    expect(sortie?.suite?.preReglage?.dice).toEqual({ d6: 1 });
    expect(sortie?.suite?.preReglage?.modifier).toBe(2);
  });

  it("une touche d'un monstre sur un allié demande la validation du MJ, sans rien lancer pour le refus", async () => {
    const fetchSimule = reponduPar(reponseTouche("leonie"));
    const sortie = await preReglageCible(parametres({})).lancer?.("leonie", { avantage: "normal" });
    expect(sortie?.suite?.libelle).toBe("Valider · dégâts");
    expect(sortie?.suite?.refus?.libelle).toBe("Faire échouer");
    expect(sortie?.suite?.refus?.sortie).toMatchObject({ what: "Raté (MJ) — aucun dégât", sansTotal: true });
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("un personnage qui touche un allié n'a pas de validation du MJ", async () => {
    reponduPar({ ...reponseTouche("leonie"), chained: { ...reponseTouche("leonie").chained, actor: { kind: "character", entityId: "e" } } });
    const sortie = await preReglageCible(parametres({ acteur: { kind: "character", entityId: "e" } })).lancer?.("leonie", { avantage: "normal" });
    expect(sortie?.suite?.refus).toBeUndefined();
  });

  it("lancer la suite relance les dégâts sur la même cible et affiche l'effet", async () => {
    const fetchSimule = reponduPar(reponseTouche("worg"));
    const sortie = await preReglageCible(parametres({})).lancer?.("worg", { avantage: "normal" });
    fetchSimule.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ ...reponseTouche("worg"), verdict: null, chained: null, amount: 4, changes: ["Worg : 20 → 16 PV (note)"], dice: { total: 4, trace: [{ text: "1d6 (2)", value: 2 }, { text: "+2", value: 2 }], pair: null, naturalD20: null } }), { status: 200 })
    );
    const degats = await sortie?.suite?.lancer();
    expect(degats).toMatchObject({ what: "Worg : 20 → 16 PV", total: 4, verdict: null });
    const corps = JSON.parse((fetchSimule.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(corps).toMatchObject({ kind: "damage", targetId: "worg", critical: false });
  });

  it("sans cible choisie, rien n'est lancé", async () => {
    const fetchSimule = reponduPar({});
    expect(await preReglageCible(parametres({})).lancer?.(null, { avantage: "normal" })).toBeNull();
    expect(fetchSimule).not.toHaveBeenCalled();
  });
});
