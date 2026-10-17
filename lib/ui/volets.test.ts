import { describe, expect, it } from "vitest";
import {
  PARTAGE_DEFAUT,
  activer,
  deplacer,
  ecrireDisposition,
  fixerPartage,
  lireDisposition,
  placer,
  retirer,
  type Disposition,
} from "./volets";

const VIDE: Disposition = { volets: [], voletActif: 0, partage: PARTAGE_DEFAUT };

function ouvrir(...ids: string[]): Disposition {
  return ids.reduce((d, id) => placer(d, id), VIDE);
}

describe("placer une fiche (V3.1-20)", () => {
  it("une fiche prend toute la zone", () => {
    expect(ouvrir("a")).toEqual({ volets: [{ onglets: ["a"], actif: "a" }], voletActif: 0, partage: 50 });
  });
  it("une deuxième ouvre le second volet, qui devient actif", () => {
    expect(ouvrir("a", "b")).toEqual({
      volets: [
        { onglets: ["a"], actif: "a" },
        { onglets: ["b"], actif: "b" },
      ],
      voletActif: 1,
      partage: 50,
    });
  });
  it("au-delà, un onglet de plus dans le volet actif, jamais un remplacement", () => {
    const d = activer(ouvrir("a", "b"), "a");
    expect(placer(d, "c").volets).toEqual([
      { onglets: ["a", "c"], actif: "c" },
      { onglets: ["b"], actif: "b" },
    ]);
    expect(placer(ouvrir("a", "b"), "c").volets[1]).toEqual({ onglets: ["b", "c"], actif: "c" });
  });
  it("une fiche déjà placée ne bouge pas : elle devient l'onglet actif de son volet", () => {
    const d = placer(placer(ouvrir("a", "b"), "c"), "a");
    expect(d.volets[0]).toEqual({ onglets: ["a"], actif: "a" });
    expect(d.voletActif).toBe(0);
    expect(d.volets[1].onglets).toEqual(["b", "c"]);
  });
});

describe("fermer", () => {
  it("fermer l'onglet actif rend la main à son voisin de gauche, sinon de droite", () => {
    const d = activer(ouvrir("a", "b", "c", "d"), "c");
    expect(retirer(d, "c").volets[1]).toEqual({ onglets: ["b", "d"], actif: "b" });
    const e = activer(d, "b");
    expect(retirer(e, "b").volets[1]).toEqual({ onglets: ["c", "d"], actif: "c" });
  });
  it("un volet vidé disparaît, l'autre reprend toute la place", () => {
    const d = retirer(ouvrir("a", "b", "c"), "a");
    expect(d.volets).toEqual([{ onglets: ["b", "c"], actif: "c" }]);
    expect(d.voletActif).toBe(0);
    expect(retirer(retirer(ouvrir("a", "b"), "b"), "a").volets).toEqual([]);
  });
  it("retirer une fiche absente ne change rien", () => {
    const d = ouvrir("a", "b");
    expect(retirer(d, "z")).toBe(d);
  });
});

describe("glisser un onglet", () => {
  it("sur l'autre volet : il y passe et y devient actif", () => {
    const d = deplacer(ouvrir("a", "b", "c"), "c", 0);
    expect(d.volets).toEqual([
      { onglets: ["a", "c"], actif: "c" },
      { onglets: ["b"], actif: "b" },
    ]);
    expect(d.voletActif).toBe(0);
  });
  it("le dernier onglet d'un volet qui part : le volet disparaît", () => {
    const d = deplacer(ouvrir("a", "b"), "b", 0);
    expect(d.volets).toEqual([{ onglets: ["a", "b"], actif: "b" }]);
    expect(d.voletActif).toBe(0);
  });
  it("hors de la barre, sur la moitié vide : crée le second volet", () => {
    const un = deplacer(ouvrir("a", "b"), "b", 0);
    const d = deplacer(un, "a", 1);
    expect(d.volets).toEqual([
      { onglets: ["b"], actif: "b" },
      { onglets: ["a"], actif: "a" },
    ]);
    expect(d.voletActif).toBe(1);
  });
  it("un volet seul à un seul onglet ne se coupe pas en deux", () => {
    const d = ouvrir("a");
    expect(deplacer(d, "a", 1)).toBe(d);
  });
  it("vers son propre volet : rien ne change", () => {
    const d = ouvrir("a", "b");
    expect(deplacer(d, "b", 1)).toBe(d);
  });
});

describe("séparateur", () => {
  it("borné entre 20 et 80 %, arrondi", () => {
    expect(fixerPartage(ouvrir("a", "b"), 12).partage).toBe(20);
    expect(fixerPartage(ouvrir("a", "b"), 91).partage).toBe(80);
    expect(fixerPartage(ouvrir("a", "b"), 61.6).partage).toBe(62);
  });
});

describe("adresse : même disposition au rechargement", () => {
  it("aller-retour exact", () => {
    const d = fixerPartage(activer(ouvrir("entite:a", "outil:notes", "regle:epee"), "outil:notes"), 63);
    const param = ecrireDisposition(d);
    expect(param).not.toBeNull();
    expect(lireDisposition(param, ["entite:a", "outil:notes", "regle:epee"])).toEqual(d);
  });
  it("sans fiche : pas de paramètre", () => {
    expect(ecrireDisposition(VIDE)).toBeNull();
  });
  it("une fiche de l'adresse qui n'est plus ouverte est oubliée ; une nouvelle est placée selon la règle", () => {
    const param = ecrireDisposition(ouvrir("a", "b", "c"));
    // « a » est fermée ailleurs : son volet disparaît ; « d » arrive, deuxième fiche → second volet.
    const d = lireDisposition(param, ["b", "c", "d"]);
    expect(d.volets).toEqual([
      { onglets: ["b", "c"], actif: "c" },
      { onglets: ["d"], actif: "d" },
    ]);
  });
  it("adresse absente (ancien lien) : les fiches se placent dans l'ordre", () => {
    expect(lireDisposition(null, ["a", "b", "c"]).volets).toEqual([
      { onglets: ["a"], actif: "a" },
      { onglets: ["b", "c"], actif: "c" },
    ]);
  });
  it("adresse abîmée : on retombe sur l'ordre, jamais d'erreur", () => {
    expect(lireDisposition("n'importe~quoi~~~9~x", ["a"]).volets).toEqual([{ onglets: ["a"], actif: "a" }]);
    expect(lireDisposition("~~~~~", ["a", "b"]).volets).toHaveLength(2);
  });
  it("la fiche primaire qui s'enregistre après le premier rendu retrouve sa place", () => {
    const param = ecrireDisposition(ouvrir("a", "b", "p"));
    // Premier rendu : la primaire n'est pas encore là.
    expect(lireDisposition(param, ["a", "b"]).volets.map((v) => v.onglets)).toEqual([["a"], ["b"]]);
    // Elle s'enregistre : retour à sa place, à droite, active.
    const d = lireDisposition(param, ["p", "a", "b"]);
    expect(d.volets).toEqual([
      { onglets: ["a"], actif: "a" },
      { onglets: ["b", "p"], actif: "p" },
    ]);
  });
});
