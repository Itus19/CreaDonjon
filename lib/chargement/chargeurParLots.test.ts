import { describe, expect, it, vi } from "vitest";
import { creerChargeurParLots } from "./chargeurParLots";

function chargeurDeTest(options: { tailleMax?: number; dureeCacheMs?: number; maintenant?: () => number } = {}) {
  const appels: string[][] = [];
  const chargeur = creerChargeurParLots<string>({
    tailleMax: options.tailleMax ?? 100,
    dureeCacheMs: options.dureeCacheMs ?? Infinity,
    maintenant: options.maintenant,
    chargerLot: async (cles) => {
      appels.push([...cles]);
      // « absent » n'existe pas cote serveur : jamais dans la reponse.
      return new Map(cles.filter((c) => c !== "absent").map((c) => [c, `valeur:${c}`]));
    },
  });
  return { chargeur, appels };
}

describe("creerChargeurParLots", () => {
  it("regroupe en une requete les demandes faites au meme moment", async () => {
    const { chargeur, appels } = chargeurDeTest();
    const [a, b] = await Promise.all([chargeur.charger(["x", "y"]), chargeur.charger(["y", "z"])]);
    expect(appels).toEqual([["x", "y", "z"]]);
    expect([...a.entries()]).toEqual([["x", "valeur:x"], ["y", "valeur:y"]]);
    expect([...b.entries()]).toEqual([["y", "valeur:y"], ["z", "valeur:z"]]);
  });

  it("ne redemande pas une cle deja chargee et encore fraiche", async () => {
    const { chargeur, appels } = chargeurDeTest();
    await chargeur.charger(["x"]);
    await chargeur.charger(["x", "y"]);
    expect(appels).toEqual([["x"], ["y"]]);
  });

  it("redemande une cle dont la reponse a perime", async () => {
    let t = 0;
    const { chargeur, appels } = chargeurDeTest({ dureeCacheMs: 1000, maintenant: () => t });
    await chargeur.charger(["x"]);
    t = 1500;
    await chargeur.charger(["x"]);
    expect(appels).toEqual([["x"], ["x"]]);
  });

  it("coupe un gros lot a la taille maximale acceptee par la route", async () => {
    const { chargeur, appels } = chargeurDeTest({ tailleMax: 2 });
    await chargeur.charger(["a", "b", "c"]);
    expect(appels).toEqual([["a", "b"], ["c"]]);
  });

  it("une cle introuvable cote serveur est absente du resultat, et n'est pas redemandee", async () => {
    const { chargeur, appels } = chargeurDeTest();
    const r = await chargeur.charger(["absent", "x"]);
    expect(r.has("absent")).toBe(false);
    await chargeur.charger(["absent"]);
    expect(appels).toEqual([["absent", "x"]]);
  });

  it("un echec rejette la demande et ne garde rien en cache", async () => {
    let echouer = true;
    const chargerLot = vi.fn(async (cles: readonly string[]) => {
      if (echouer) throw new Error("reseau");
      return new Map(cles.map((c) => [c, c]));
    });
    const chargeur = creerChargeurParLots<string>({ tailleMax: 10, dureeCacheMs: Infinity, chargerLot });
    await expect(chargeur.charger(["x"])).rejects.toThrow("reseau");
    echouer = false;
    await expect(chargeur.charger(["x"])).resolves.toEqual(new Map([["x", "x"]]));
    expect(chargerLot).toHaveBeenCalledTimes(2);
  });

  it("vider oublie les cles choisies", async () => {
    const { chargeur, appels } = chargeurDeTest();
    await chargeur.charger(["monde1:x", "monde2:x"]);
    chargeur.vider((cle) => cle.startsWith("monde1:"));
    await chargeur.charger(["monde1:x", "monde2:x"]);
    expect(appels).toEqual([["monde1:x", "monde2:x"], ["monde1:x"]]);
  });

  it("lireSiPret rend le cache sans attendre, seulement si toutes les cles sont fraiches", async () => {
    const { chargeur } = chargeurDeTest();
    expect(chargeur.lireSiPret(["x"])).toBeNull();
    await chargeur.charger(["x", "absent"]);
    expect(chargeur.lireSiPret(["x", "absent"])).toEqual(new Map([["x", "valeur:x"]]));
    expect(chargeur.lireSiPret(["x", "y"])).toBeNull();
  });

  it("amorcer : une promesse deja lancee sert la cle, sans requete", async () => {
    const { chargeur, appels } = chargeurDeTest();
    chargeur.amorcer("x", Promise.resolve("venue-du-serveur"));
    expect(await chargeur.charger(["x", "y"])).toEqual(new Map([["x", "venue-du-serveur"], ["y", "valeur:y"]]));
    expect(appels).toEqual([["y"]]);
  });

  it("amorcer : une promesse rendant undefined laisse la cle se charger normalement", async () => {
    const { chargeur, appels } = chargeurDeTest();
    chargeur.amorcer("x", Promise.resolve(undefined));
    expect(await chargeur.charger(["x"])).toEqual(new Map([["x", "valeur:x"]]));
    expect(appels).toEqual([["x"]]);
  });

  it("amorcer : un echec de la promesse retombe sur une requete normale", async () => {
    const { chargeur, appels } = chargeurDeTest();
    chargeur.amorcer("x", Promise.reject(new Error("serveur")));
    expect(await chargeur.charger(["x"])).toEqual(new Map([["x", "valeur:x"]]));
    expect(appels).toEqual([["x"]]);
  });

  it("amorcer n'ecrase jamais une cle deja en cache", async () => {
    const { chargeur, appels } = chargeurDeTest();
    await chargeur.charger(["x"]);
    chargeur.amorcer("x", Promise.resolve("ancienne"));
    expect(await chargeur.charger(["x"])).toEqual(new Map([["x", "valeur:x"]]));
    expect(appels).toEqual([["x"]]);
  });

  it("amorcer accepte un « thenable » dont then ne renvoie rien (promesse venue du serveur par React)", async () => {
    const { chargeur, appels } = chargeurDeTest();
    const thenable = {
      then(ok: (v: string) => void) {
        setTimeout(() => ok("venue-du-serveur"), 0);
      },
    };
    chargeur.amorcer("x", thenable as unknown as Promise<string>);
    expect(await chargeur.charger(["x"])).toEqual(new Map([["x", "venue-du-serveur"]]));
    expect(appels).toEqual([]);
  });

  it("aucune requete pour une liste vide", async () => {
    const { chargeur, appels } = chargeurDeTest();
    expect((await chargeur.charger([])).size).toBe(0);
    expect(appels).toEqual([]);
  });
});
