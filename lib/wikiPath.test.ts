import { describe, expect, it } from "vitest";
import { entitySlugFromPathname } from "./wikiPath";
import { config } from "../proxy";

describe("entitySlugFromPathname", () => {
  it("rend le segment de fiche d'un chemin de partage", () => {
    expect(entitySlugFromPathname("/partage/jeton/37", "/partage/jeton")).toBe("37");
  });

  it("rend le segment sur les trois routes de wiki", () => {
    expect(entitySlugFromPathname("/m/valdoria/apercu/prologue", "/m/valdoria/apercu")).toBe("prologue");
    expect(entitySlugFromPathname("/m/valdoria/joueur/wiki/prologue", "/m/valdoria/joueur/wiki")).toBe("prologue");
  });

  it("desencode le slug, comme EntityTree pour la fiche active", () => {
    expect(entitySlugFromPathname("/partage/jeton/fa%C3%ABr%C3%BBn", "/partage/jeton")).toBe("faërûn");
  });

  it("ignore ce qui suit le segment de fiche", () => {
    expect(entitySlugFromPathname("/partage/jeton/37/autre", "/partage/jeton")).toBe("37");
  });

  it("rend null sur la page de sommaire, qui n'a pas de fiche", () => {
    expect(entitySlugFromPathname("/partage/jeton", "/partage/jeton")).toBeNull();
    expect(entitySlugFromPathname("/partage/jeton/", "/partage/jeton")).toBeNull();
  });

  it("rend null quand l'en-tete est absent — le layout retombe alors sur son comportement d'avant", () => {
    expect(entitySlugFromPathname(null, "/partage/jeton")).toBeNull();
    expect(entitySlugFromPathname(undefined, "/partage/jeton")).toBeNull();
    expect(entitySlugFromPathname("", "/partage/jeton")).toBeNull();
  });

  it("rend null pour un chemin d'une autre route", () => {
    expect(entitySlugFromPathname("/m/valdoria/f/37", "/partage/jeton")).toBeNull();
  });

  it("rend null plutot que de jeter sur une sequence d'echappement invalide", () => {
    expect(entitySlugFromPathname("/partage/jeton/%E0%A4%A", "/partage/jeton")).toBeNull();
  });
});

/**
 * V2.1-20 lot 2.1 — le garde anti-echec-muet.
 *
 * Depuis ce lot, le fond de page wiki est rendu cote serveur grace a un en-tete
 * que le middleware pose. Si `/partage` sortait du `matcher`, l'en-tete
 * disparaitrait, `entitySlugFromPathname` rendrait `null`, et le fond
 * retomberait au comportement d'avant : **sans erreur, sans test rouge**.
 *
 * Or le lot 4 du meme ticket veut precisement alleger le middleware sur
 * `/partage`. Sa description dit qu'il doit court-circuiter l'appel reseau sans
 * retirer la route du `matcher` — mais une phrase dans un backlog n'arrete
 * personne. Ce test-ci, si.
 */
describe("le middleware couvre les routes de wiki (V2.1-20 lot 2.1)", () => {
  const motifs = config.matcher.map((m) => new RegExp(`^${m}$`));
  const couvert = (chemin: string) => motifs.some((r) => r.test(chemin));

  it("couvre /partage, d'ou le fond de page tire sa fiche", () => {
    expect(couvert("/partage/un-jeton/37")).toBe(true);
  });

  it("couvre les deux autres routes de wiki", () => {
    expect(couvert("/m/valdoria/apercu/prologue")).toBe(true);
    expect(couvert("/m/valdoria/joueur/wiki/prologue")).toBe(true);
  });

  // Temoin : sans lui, les trois assertions ci-dessus passeraient aussi bien si
  // `couvert` rendait `true` pour n'importe quoi.
  it("ne couvre pas les fichiers statiques, que le matcher exclut deja", () => {
    expect(couvert("/_next/static/chunk.js")).toBe(false);
    expect(couvert("/favicon.ico")).toBe(false);
  });
});
