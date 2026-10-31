import { afterEach, describe, expect, it, vi } from "vitest";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { PlayerCombatParticipant } from "@/src/core/rules/combatPlayerView";
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
  blessure: (etat) => ({ unhurt: "Indemne", hurt: "Blessé", bloodied: "En sang", down: "Hors de combat" })[etat],
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

describe("preReglageCible · joueuse (V3.1-107)", () => {
  const vue = [
    { id: "worg", label: "Worg", side: "enemy", wound: "bloodied", hp: null },
    { id: "leonie", label: "Léonie", side: "ally", wound: null, hp: { current: 15, max: 20, temp: 2 } },
  ] as unknown as PlayerCombatParticipant[];
  const acteur = { kind: "character", entityId: "e" } as const;
  const joueuse = () => parametres({ acteur, nomActeur: "Léonie", action: { kind: "weapon", itemId: "epee" }, participants: [], joueur: vue });
  const touche = (jeton?: string) => ({
    ...reponseTouche("worg"),
    changes: [],
    chained: { kind: "damage", actor: acteur, action: { kind: "weapon", itemId: "epee" }, targetId: "worg", critical: false, ...(jeton ? { token: jeton } : {}) },
  });

  it("liste la vue filtrée : état de blessure d'un adversaire, PV d'un allié", () => {
    expect(preReglageCible(joueuse()).cibles).toEqual([
      { id: "worg", label: "Worg", info: "Adversaire · En sang" },
      { id: "leonie", label: "Léonie", info: "Allié · 17/20" },
    ]);
  });

  it("lance par la route de la joueuse, sans critique ni secret, puis renvoie le jeton avec les dégâts", async () => {
    const fetchSimule = reponduPar(touche("jeton-signe"));
    const sortie = await preReglageCible(joueuse()).lancer?.("worg", { avantage: "advantage" });
    const [url, init] = fetchSimule.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/campaigns/c/combats/k/player-targeted-roll");
    const corps = JSON.parse(init.body as string);
    expect(corps).toEqual({ kind: "attack", actor: acteur, action: { kind: "weapon", itemId: "epee" }, targetId: "worg", advantage: "advantage" });

    fetchSimule.mockImplementationOnce(async () => new Response(JSON.stringify({ ...touche(), verdict: null, chained: null, amount: 4, changes: ["Un adversaire est blessé"], dice: null }), { status: 200 }));
    await sortie?.suite?.lancer();
    const degats = JSON.parse((fetchSimule.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(degats).toMatchObject({ kind: "damage", targetId: "worg", damageToken: "jeton-signe" });
    expect(degats).not.toHaveProperty("critical");
  });

  it("un refus du serveur (503) est affiché tel quel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Le moteur n'a pas pu résoudre ce jet. Prévenez le MJ." }), { status: 503 })));
    await expect(preReglageCible(joueuse()).lancer?.("worg", { avantage: "normal" })).rejects.toThrow("Le moteur n'a pas pu résoudre ce jet. Prévenez le MJ.");
  });
});

