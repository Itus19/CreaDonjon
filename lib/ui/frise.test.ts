import { describe, expect, it } from "vitest";
import type { CalendarConfig } from "@/src/core/calendar/types";
import type { TimelineEntry } from "@/src/core/schemas/blocks/timeline";
import type { WorldTimelineEntry } from "@/src/server/services/timeline";
import { summarizeView } from "@/src/core/timeline/view";
import {
  centreApresGlisser,
  estModifiable,
  estVueJoueurs,
  facteurPincement,
  fichesAvecChronologie,
  fichesDuFlux,
  filtrerEntrees,
  FILTRES_VIERGES,
  gesteMolette,
  peutFaireFiche,
  plageEre,
  pointsDeFrise,
  porteeSuivante,
  vueInitiale,
  vueSurPlage,
} from "./frise";

const calendrier: CalendarConfig = {
  months: [{ name: "Un", days: 100 }],
  weekdays: [{ name: "Lun" }],
  eras: [],
  currentDate: null,
  weekdayEpoch: 0,
};

function entree(over: {
  id?: string;
  year: number;
  kind?: TimelineEntry["kind"];
  scope?: WorldTimelineEntry["scope"];
  title?: string;
  summary?: string;
  source?: WorldTimelineEntry["source"];
  entite?: string;
  block?: WorldTimelineEntry["block"];
  ref?: string | null;
}): WorldTimelineEntry {
  return {
    entry: {
      id: over.id ?? `e${over.year}`,
      date: { year: over.year, month: 1, day: 1, precision: "day", end: null, label: null },
      kind: over.kind ?? "war",
      title: over.title ?? "Titre",
      summary: over.summary ?? "",
      visibility: { level: "public", scopeId: null },
    },
    scope: over.scope ?? "major",
    source: over.source ?? { kind: "world" },
    sortKey: over.year,
    sourceEntityId: over.entite ?? "monde",
    sourceEntityName: over.entite ?? "Chronologie du monde",
    sourceEntitySlug: "slug",
    refEntitySlug: over.ref ?? null,
    block: over.block === undefined ? { id: "b", version: 1 } : over.block,
  };
}

describe("pointsDeFrise", () => {
  it("place chaque entrée à son année et garde la portée résolue par le serveur", () => {
    const pts = pointsDeFrise([entree({ year: 10 }), entree({ year: 30, scope: "detail" })], calendrier);
    expect(pts.map((p) => p.year)).toEqual([10, 30]);
    expect(pts.map((p) => p.scope)).toEqual(["major", "detail"]);
    expect(new Set(pts.map((p) => p.id)).size).toBe(2);
  });

  it("le compteur des dates cachées est celui du noyau : 500 ans de vue ne montrent que les grandes dates", () => {
    const pts = pointsDeFrise(
      [entree({ year: 10 }), entree({ year: 20, scope: "notable" }), entree({ year: 30, scope: "detail" })],
      calendrier
    );
    const large = summarizeView(pts, { center: 20, span: 500 });
    expect(large).toMatchObject({ visibleCount: 1, hiddenCount: 2 });
    const serre = summarizeView(pts, { center: 20, span: 100 });
    expect(serre).toMatchObject({ visibleCount: 3, hiddenCount: 0 });
  });
});

describe("filtrerEntrees", () => {
  const flux = [
    entree({ year: 1, kind: "birth", title: "Naissance d'Éloïse", entite: "eloise", source: { kind: "birth" }, block: null }),
    entree({ year: 2, kind: "war", title: "La grande guerre", summary: "Les Cendres" }),
  ];
  it("sans filtre, tout passe", () => {
    expect(filtrerEntrees(flux, FILTRES_VIERGES)).toHaveLength(2);
  });
  it("par genre", () => {
    expect(filtrerEntrees(flux, { ...FILTRES_VIERGES, genre: "war" })).toHaveLength(1);
  });
  it("par fiche", () => {
    expect(filtrerEntrees(flux, { ...FILTRES_VIERGES, fiche: "eloise" }).map((e) => e.entry.kind)).toEqual(["birth"]);
  });
  it("recherche sans accent ni casse, dans le titre, le résumé et le nom de la fiche", () => {
    expect(filtrerEntrees(flux, { ...FILTRES_VIERGES, recherche: "eloise" })).toHaveLength(1);
    expect(filtrerEntrees(flux, { ...FILTRES_VIERGES, recherche: "CENDRES" })).toHaveLength(1);
    expect(filtrerEntrees(flux, { ...FILTRES_VIERGES, recherche: "zzz" })).toHaveLength(0);
  });
});

describe("fiches du flux", () => {
  const flux = [
    entree({ year: 1, entite: "B", source: { kind: "entity", blockId: "b" } }),
    entree({ year: 2, entite: "A", source: { kind: "birth" }, block: null }),
    entree({ year: 3 }),
    entree({ year: 4, entite: "B", source: { kind: "entity", blockId: "b" } }),
  ];
  it("liste les fiches sans doublon, hors frise générale", () => {
    expect(fichesDuFlux(flux).map((f) => f.id)).toEqual(["A", "B"]);
  });
  it("ne propose pour l'ajout que les fiches qui portent un bloc Chronologie", () => {
    expect(fichesAvecChronologie(flux).map((f) => f.id)).toEqual(["B"]);
  });
});

describe("cartes", () => {
  it("la portée tourne Monde, Région, Détail, Monde", () => {
    expect(porteeSuivante("major")).toBe("notable");
    expect(porteeSuivante("notable")).toBe("detail");
    expect(porteeSuivante("detail")).toBe("major");
  });
  it("une naissance n'est pas modifiable, une entrée de bloc l'est", () => {
    expect(estModifiable(entree({ year: 1, block: null }))).toBe(false);
    expect(estModifiable(entree({ year: 1 }))).toBe(true);
  });
  it("« en faire une fiche » seulement sans fiche déjà liée", () => {
    expect(peutFaireFiche(entree({ year: 1 }))).toBe(true);
    expect(peutFaireFiche(entree({ year: 1, ref: "x" }))).toBe(false);
    expect(peutFaireFiche(entree({ year: 1, block: null }))).toBe(false);
  });
});

describe("vues", () => {
  const monde = { start: 0, end: 1000 };
  it("de départ : un siècle autour d'aujourd'hui, aujourd'hui au quart gauche", () => {
    expect(vueInitiale(monde, 400)).toEqual({ span: 130, center: 432.5 });
  });
  it("de départ sans aujourd'hui : tout le monde", () => {
    expect(vueInitiale(monde, null)).toEqual({ span: 1000, center: 500 });
  });
  it("sur une plage : la plage avec une marge, jamais sous 20 ans", () => {
    expect(vueSurPlage({ start: 100, end: 200 }, monde)).toEqual({ center: 150, span: 150 });
    expect(vueSurPlage({ start: 100, end: 100 }, monde).span).toBe(20);
  });
});

describe("gestes", () => {
  it("molette seule : défile, bas vers la droite", () => {
    expect(gesteMolette({ deltaX: 0, deltaY: 100, ctrlKey: false })).toEqual({ type: "defiler", sens: 1 });
    expect(gesteMolette({ deltaX: 0, deltaY: -100, ctrlKey: false })).toEqual({ type: "defiler", sens: -1 });
  });
  it("molette horizontale : défile aussi", () => {
    expect(gesteMolette({ deltaX: -30, deltaY: 4, ctrlKey: false })).toEqual({ type: "defiler", sens: -1 });
  });
  it("Ctrl + molette : zoome, haut = avant", () => {
    expect(gesteMolette({ deltaX: 0, deltaY: -100, ctrlKey: true })).toEqual({ type: "zoom", sens: "in" });
    expect(gesteMolette({ deltaX: 0, deltaY: 100, ctrlKey: true })).toEqual({ type: "zoom", sens: "out" });
  });
  it("rien ne bouge sans mouvement", () => {
    expect(gesteMolette({ deltaX: 0, deltaY: 0, ctrlKey: false })).toBeNull();
    expect(gesteMolette({ deltaX: 0, deltaY: 0, ctrlKey: true })).toBeNull();
  });
  it("glisser vers la droite recule dans le temps ; la largeur utile retire les marges", () => {
    // largeur 520 : 300 px utiles pour 60 ans, soit 5 px par an
    expect(centreApresGlisser(100, 50, 60, 520)).toBe(90);
    expect(centreApresGlisser(100, -50, 60, 520)).toBe(110);
  });
  it("pincer : l'écart qui double divise l'étendue par deux", () => {
    expect(facteurPincement(100, 200)).toBe(0.5);
    expect(facteurPincement(0, 200)).toBeNull();
  });
});

describe("plageEre", () => {
  const eres = [
    { name: "Seconde", startYear: 1302 },
    { name: "Première", startYear: 0 },
  ];
  it("va jusqu'à l'ère suivante, quel que soit l'ordre de saisie", () => {
    expect(plageEre(eres, 1, 1500)).toEqual({ debut: 0, fin: 1302 });
  });
  it("la dernière va jusqu'à aujourd'hui", () => {
    expect(plageEre(eres, 0, 1479.6)).toEqual({ debut: 1302, fin: 1479 });
  });
  it("sans jour actuel, la dernière reste ouverte", () => {
    expect(plageEre(eres, 0, null).fin).toBeNull();
  });
});

describe("estVueJoueurs", () => {
  it("seule la valeur « joueurs » demande la vue des joueurs", () => {
    expect(estVueJoueurs("joueurs")).toBe(true);
    expect(estVueJoueurs("mj")).toBe(false);
    expect(estVueJoueurs(undefined)).toBe(false);
    expect(estVueJoueurs(["joueurs"])).toBe(false);
  });
});
