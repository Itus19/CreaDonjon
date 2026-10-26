import { describe, expect, it } from "vitest";
import {
  capacites,
  deplacerPiste,
  ecrireTemps,
  formaterFondu,
  lireTemps,
  noteFondus,
  pasFondu,
  texteBornes,
  validerLien,
  validerPiste,
} from "./musique";

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SPOTIFY = "https://open.spotify.com/track/abc";
const SOUNDCLOUD = "https://soundcloud.com/artiste/titre";

describe("lireTemps", () => {
  it("« 0:12 » donne 12, « 1:30 » 90, « 1:00:00 » 3600", () => {
    expect(lireTemps("0:12")).toEqual({ ok: true, secondes: 12 });
    expect(lireTemps("1:30")).toEqual({ ok: true, secondes: 90 });
    expect(lireTemps("1:00:00")).toEqual({ ok: true, secondes: 3600 });
  });
  it("des secondes seules passent", () => {
    expect(lireTemps("45")).toEqual({ ok: true, secondes: 45 });
  });
  it("vide donne « absent » (la borne s'efface)", () => {
    expect(lireTemps("")).toEqual({ ok: true, secondes: undefined });
    expect(lireTemps("   ")).toEqual({ ok: true, secondes: undefined });
  });
  it("refuse ce qui n'est pas un temps", () => {
    for (const mauvais of ["abc", "1:75", "-3", "1:2:3:4", "1,5", "0:1x", ":30"]) expect(lireTemps(mauvais)).toEqual({ ok: false });
  });
});

describe("ecrireTemps", () => {
  it("écrit m:ss, et h:mm:ss au-delà d'une heure", () => {
    expect(ecrireTemps(12)).toBe("0:12");
    expect(ecrireTemps(72)).toBe("1:12");
    expect(ecrireTemps(3600)).toBe("1:00:00");
    expect(ecrireTemps(3661)).toBe("1:01:01");
    expect(ecrireTemps(undefined)).toBe("");
  });
  it("relit ce qu'il écrit", () => {
    for (const s of [0, 1, 59, 60, 599, 3599, 3600, 86399]) expect(lireTemps(ecrireTemps(s))).toEqual({ ok: true, secondes: s });
  });
});

describe("validerPiste : le schéma décide", () => {
  const base = { id: "t", url: YT };
  it("accepte une piste sans borne, ou bien bornée", () => {
    expect(validerPiste(base).ok).toBe(true);
    expect(validerPiste({ ...base, startSeconds: 12, endSeconds: 60 }).ok).toBe(true);
  });
  it("refuse une fin ≤ début avec le message du schéma", () => {
    expect(validerPiste({ ...base, startSeconds: 30, endSeconds: 30 })).toEqual({ ok: false, message: "La fin doit venir après le début." });
    expect(validerPiste({ ...base, startSeconds: 30, endSeconds: 10 })).toEqual({ ok: false, message: "La fin doit venir après le début." });
  });
  it("refuse un lien non reconnu avec le message du schéma", () => {
    expect(validerLien("https://exemple.org/musique")).toEqual({
      ok: false,
      message: "Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptés.",
    });
    expect(validerLien(YT).ok).toBe(true);
  });
});

describe("fondus : de 0 à 5 s, par pas de 0,5 s", () => {
  it("monte et descend d'un cran", () => {
    expect(pasFondu(1500, 1)).toBe(2000);
    expect(pasFondu(1500, -1)).toBe(1000);
  });
  it("reste entre 0 et 5000", () => {
    expect(pasFondu(5000, 1)).toBe(5000);
    expect(pasFondu(0, -1)).toBe(0);
  });
  it("ramène une valeur hors grille sur la grille", () => {
    expect(pasFondu(1600, 1)).toBe(2000);
    expect(pasFondu(1600, -1)).toBe(1500);
  });
  it("s'affiche « 1,5 s »", () => {
    expect(formaterFondu(1500)).toBe("1,5 s");
    expect(formaterFondu(2000)).toBe("2 s");
    expect(formaterFondu(0)).toBe("0 s");
    expect(formaterFondu(500)).toBe("0,5 s");
  });
});

describe("ce que permet chaque service", () => {
  it("YouTube : bornes et fondus", () => {
    expect(capacites(YT)).toEqual({ service: "youtube", bornes: true, fondus: true });
  });
  it("Spotify et SoundCloud : ni bornes ni fondus", () => {
    expect(capacites(SPOTIFY)).toEqual({ service: "spotify", bornes: false, fondus: false });
    expect(capacites(SOUNDCLOUD)).toEqual({ service: "soundcloud", bornes: false, fondus: false });
  });
  it("la platine dit les fondus, ou pourquoi il n'y en a pas", () => {
    expect(noteFondus(YT, 1500, 2000)).toEqual({ cle: "fondus", entrant: "1,5 s", sortant: "2 s" });
    expect(noteFondus(SPOTIFY, 1500, 1500)).toEqual({ cle: "aucun", service: "spotify" });
  });
});

describe("texteBornes", () => {
  const mots = { debut: "début", fin: "fin" };
  it("« 0:12 → fin »", () => {
    expect(texteBornes(12, undefined, mots)).toBe("0:12 → fin");
    expect(texteBornes(undefined, 90, mots)).toBe("début → 1:30");
    expect(texteBornes(12, 90, mots)).toBe("0:12 → 1:30");
  });
  it("rien pour une piste entière", () => {
    expect(texteBornes(undefined, undefined, mots)).toBeNull();
  });
});

describe("deplacerPiste", () => {
  it("range une piste", () => {
    expect(deplacerPiste(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(deplacerPiste(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("hors bornes : liste inchangée", () => {
    expect(deplacerPiste(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
