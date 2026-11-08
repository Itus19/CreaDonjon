import { describe, expect, it } from "vitest";
import {
  VUE_DEPART,
  apercuZone,
  arrondiDemi,
  arrondiPose,
  ciblesAEnvoyer,
  contourZone,
  deplacerVue,
  distanceAffichee,
  echelleBarre,
  ecranVersMetres,
  etapeSuivante,
  etapesZone,
  initiales,
  jetonsDepuisLignes,
  jetonsDepuisVue,
  metresVersEcran,
  pixelsParMetre,
  positionAffichee,
  repartir,
  resumeMouvement,
  vueQuiCadre,
  zoomerAutour,
  ZOOM_MAX,
  ZOOM_MIN,
  type JetonPlan,
} from "@/lib/ui/planCombat";

const CADRE = { largeur: 400, hauteur: 300 };

function jeton(id: string, pos: { x: number; y: number } | null, camp: JetonPlan["camp"] = "enemy"): JetonPlan {
  return { id, label: id, pos, camp, abattu: false, actif: false };
}

describe("conversions écran / mètres", () => {
  it("le centre de la vue tombe au milieu du cadre", () => {
    const s = metresVersEcran({ x: 0, y: 0 }, VUE_DEPART, CADRE);
    expect(s).toEqual({ x: 200, y: 150 });
  });

  it("aller-retour : mètres -> écran -> mètres", () => {
    const vue = { zoom: 2.5, centre: { x: 3, y: -4 } };
    const m = { x: 7.25, y: 1.5 };
    const retour = ecranVersMetres(metresVersEcran(m, vue, CADRE), vue, CADRE);
    expect(retour.x).toBeCloseTo(m.x, 9);
    expect(retour.y).toBeCloseTo(m.y, 9);
  });

  it("le zoom agrandit : un mètre fait plus de pixels", () => {
    expect(pixelsParMetre({ ...VUE_DEPART, zoom: 2 })).toBe(2 * pixelsParMetre(VUE_DEPART));
  });

  it("glisser la vue de 40 px vers la droite recentre vers la gauche du plan", () => {
    const vue = deplacerVue(VUE_DEPART, 40, 0);
    expect(vue.centre.x).toBeCloseTo(-40 / pixelsParMetre(VUE_DEPART), 9);
    expect(vue.centre.y).toBe(0);
  });
});

describe("zoom autour d'un point", () => {
  it("le point sous le doigt ne bouge pas à l'écran", () => {
    const vue = { zoom: 1, centre: { x: 2, y: 3 } };
    const doigt = { x: 310, y: 90 };
    const avant = ecranVersMetres(doigt, vue, CADRE);
    const apres = zoomerAutour(vue, CADRE, doigt, 1.8);
    const encore = ecranVersMetres(doigt, apres, CADRE);
    expect(apres.zoom).toBeCloseTo(1.8, 9);
    expect(encore.x).toBeCloseTo(avant.x, 9);
    expect(encore.y).toBeCloseTo(avant.y, 9);
  });

  it("le zoom reste dans ses bornes", () => {
    expect(zoomerAutour(VUE_DEPART, CADRE, { x: 0, y: 0 }, 1000).zoom).toBe(ZOOM_MAX);
    expect(zoomerAutour(VUE_DEPART, CADRE, { x: 0, y: 0 }, 0.0001).zoom).toBe(ZOOM_MIN);
  });
});

describe("cadrer la vue", () => {
  it("sans jeton, la vue de départ", () => {
    expect(vueQuiCadre([], CADRE)).toEqual(VUE_DEPART);
  });

  it("deux jetons éloignés tiennent dans le cadre", () => {
    const pts = [
      { x: -20, y: 0 },
      { x: 20, y: 10 },
    ];
    const vue = vueQuiCadre(pts, CADRE);
    for (const p of pts) {
      const s = metresVersEcran(p, vue, CADRE);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(CADRE.largeur);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(CADRE.hauteur);
    }
  });
});

describe("affichage des mètres", () => {
  it("arrondit au demi-mètre", () => {
    expect(arrondiDemi(4.24)).toBe(4);
    expect(arrondiDemi(4.26)).toBe(4.5);
    expect(arrondiDemi(4.8)).toBe(5);
  });

  it("la distance affichée est celle de la géométrie, arrondie", () => {
    expect(distanceAffichee({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceAffichee({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1.5);
  });

  it("une position posée est au centimètre et dans les bornes du serveur", () => {
    expect(arrondiPose({ x: 1.23456, y: -2.0049 })).toEqual({ x: 1.23, y: -2 });
    expect(arrondiPose({ x: 5000, y: -5000 })).toEqual({ x: 1000, y: -1000 });
  });

  it("l'échelle choisit une longueur ronde d'au plus 120 px", () => {
    for (const zoom of [0.25, 0.5, 1, 2, 4, 8]) {
      const e = echelleBarre({ zoom, centre: { x: 0, y: 0 } });
      expect(e.px).toBeLessThanOrEqual(120 + 1e-9);
      expect([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]).toContain(e.metres);
    }
  });
});

describe("jetons", () => {
  it("les jetons sans position vont dans la réserve", () => {
    const { poses, reserve } = repartir([jeton("a", { x: 1, y: 1 }), jeton("b", null), jeton("c", { x: 0, y: 0 })]);
    expect(poses.map((j) => j.id)).toEqual(["a", "c"]);
    expect(reserve.map((j) => j.id)).toEqual(["b"]);
  });

  it("les initiales : deux lettres au plus", () => {
    expect(initiales("Gobelin archer")).toBe("GA");
    expect(initiales("Thorin")).toBe("TH");
    expect(initiales("  ")).toBe("?");
  });

  it("depuis les lignes du MJ : camp, position, abattu, actif", () => {
    const jetons = jetonsDepuisLignes(
      [
        { id: "p1", label: "Aela", is_ally: true, pos_x: 1, pos_y: 2, hp_max: 10, hp_current: 4 },
        { id: "m1", label: "Gobelin", is_ally: false, pos_x: null, pos_y: null, hp_max: 7, hp_current: 0 },
        { id: "m2", label: "Orc", is_ally: false, pos_x: 3, pos_y: null, hp_max: null, hp_current: null },
      ],
      "p1"
    );
    expect(jetons[0]).toMatchObject({ id: "p1", camp: "ally", pos: { x: 1, y: 2 }, abattu: false, actif: true });
    expect(jetons[1]).toMatchObject({ id: "m1", camp: "enemy", pos: null, abattu: true, actif: false });
    // Une moitié de position ne pose pas de jeton.
    expect(jetons[2].pos).toBeNull();
  });

  it("depuis la vue de la joueuse", () => {
    const jetons = jetonsDepuisVue([
      { id: "p1", label: "Aela", side: "ally", position: { x: 1, y: 1 }, wound: "unhurt", isCurrent: true },
      { id: "m1", label: "Gobelin", side: "enemy", position: null, wound: "down", isCurrent: false },
    ]);
    expect(jetons[0]).toMatchObject({ camp: "ally", actif: true, pos: { x: 1, y: 1 } });
    expect(jetons[1]).toMatchObject({ camp: "enemy", abattu: true, pos: null });
  });
});

describe("mise à jour optimiste", () => {
  const base = { x: 0, y: 0 };
  const posee = { x: 2, y: 2 };

  it("sans surcharge, la position du serveur", () => {
    expect(positionAffichee(base, undefined)).toEqual(base);
  });

  it("tant que le serveur n'a pas rattrapé, le jeton reste où on l'a posé", () => {
    expect(positionAffichee(base, { base, pos: posee })).toEqual(posee);
  });

  it("quand le serveur rattrape, sa position", () => {
    expect(positionAffichee(posee, { base, pos: posee })).toEqual(posee);
  });

  it("si quelqu'un d'autre l'a bougé ailleurs, le serveur gagne", () => {
    expect(positionAffichee({ x: 9, y: 9 }, { base, pos: posee })).toEqual({ x: 9, y: 9 });
  });

  it("retirer du plan : pos null tient jusqu'à ce que le serveur rattrape", () => {
    expect(positionAffichee(base, { base, pos: null })).toBeNull();
    expect(positionAffichee(null, { base, pos: null })).toBeNull();
  });
});

describe("mouvement du tour", () => {
  it("arrondi au demi-mètre, dépassement signalé", () => {
    expect(resumeMouvement({ moved: 6.26, speed: 9, over: false })).toEqual({ deplace: 6.5, vitesse: 9, depasse: false });
    expect(resumeMouvement({ moved: 10, speed: 9, over: true })?.depasse).toBe(true);
    expect(resumeMouvement(null)).toBeNull();
  });
});

describe("l'outil de zone", () => {
  const lanceur = jeton("pj", { x: 0, y: 0 }, "ally");
  const devant1 = jeton("g1", { x: 3, y: 0.5 });
  const devant2 = jeton("g2", { x: 4, y: -1 });
  const derriere = jeton("g3", { x: -3, y: 0 });
  const loin = jeton("g4", { x: 10, y: 0 });
  const nonPose = jeton("g5", null);
  const jetons = [lanceur, devant1, devant2, derriere, loin, nonPose];
  const cone = { shape: "cone" as const, size: 4.5, origin: "self" as const };

  it("les étapes : un cône depuis soi demande une direction seulement", () => {
    expect(etapesZone(cone)).toEqual(["aim"]);
    expect(etapesZone({ shape: "sphere", size: 6, origin: "point" })).toEqual(["point"]);
    expect(etapesZone({ shape: "line", size: 9, origin: "point" })).toEqual(["point", "aim"]);
    expect(etapesZone({ shape: "sphere", size: 3, origin: "self" })).toEqual([]);
  });

  it("l'étape suivante est la première qui manque", () => {
    const ligne = { shape: "line" as const, size: 9, origin: "point" as const };
    expect(etapeSuivante(ligne, {})).toBe("point");
    expect(etapeSuivante(ligne, { point: { x: 1, y: 1 } })).toBe("aim");
    expect(etapeSuivante(ligne, { point: { x: 1, y: 1 }, aim: { x: 2, y: 1 } })).toBeNull();
  });

  it("un cône prend les deux gobelins devant et pas celui derrière", () => {
    const r = apercuZone({ zone: { spec: cone, lanceurId: "pj" }, jetons, aim: { x: 5, y: 0 } });
    expect(r).toMatchObject({ etat: "ok" });
    if (r.etat === "ok") expect(r.ids).toEqual(["g1", "g2"]);
  });

  it("sans direction, l'aperçu est incomplet", () => {
    expect(apercuZone({ zone: { spec: cone, lanceurId: "pj" }, jetons })).toEqual({ etat: "incomplet", manque: "no_aim" });
  });

  it("un lanceur non posé ne pose pas une zone qui part de lui", () => {
    const sans = jetons.map((j) => (j.id === "pj" ? { ...j, pos: null } : j));
    expect(apercuZone({ zone: { spec: cone, lanceurId: "pj" }, jetons: sans, aim: { x: 5, y: 0 } })).toEqual({ etat: "incomplet", manque: "no_position" });
  });

  it("une sphère posée à un point hors de portée est refusée", () => {
    const sphere = { shape: "sphere" as const, size: 3, origin: "point" as const };
    const zone = { spec: sphere, lanceurId: "pj", portee: 6 };
    expect(apercuZone({ zone, jetons, point: { x: 20, y: 0 } })).toEqual({ etat: "incomplet", manque: "out_of_range" });
    const ok = apercuZone({ zone, jetons, point: { x: 5, y: 0 } });
    expect(ok.etat).toBe("ok");
    if (ok.etat === "ok") expect(ok.ids).toEqual(["g1", "g2"]);
  });

  it("le contour : cercle pour une sphère, polygones pour le reste", () => {
    expect(contourZone({ shape: "sphere", size: 3, origin: "point" }, { x: 1, y: 1 })).toEqual({ type: "cercle", centre: { x: 1, y: 1 }, rayon: 3 });
    const c = contourZone(cone, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(c?.type).toBe("polygone");
    if (c?.type === "polygone") {
      expect(c.points).toHaveLength(3);
      // Le bout du cône est large comme sa longueur : demi-largeur = size / 2.
      expect(c.points[1]).toEqual({ x: 4.5, y: 2.25 });
      expect(c.points[2]).toEqual({ x: 4.5, y: -2.25 });
    }
    const cube = contourZone({ shape: "cube", size: 4, origin: "point" }, { x: 0, y: 0 });
    expect(cube?.type === "polygone" && cube.points).toHaveLength(4);
    expect(contourZone(cone, { x: 0, y: 0 })).toBeNull();
  });

  it("cibles à envoyer : toutes gardées -> rien (le serveur calcule) ; certaines retirées -> les gardées", () => {
    expect(ciblesAEnvoyer(["a", "b"], ["a", "b"])).toEqual({ ids: [], valide: true });
    expect(ciblesAEnvoyer(["a", "b"], ["a"])).toEqual({ ids: ["a"], valide: true });
    expect(ciblesAEnvoyer(["a", "b"], [])).toEqual({ ids: [], valide: false });
    expect(ciblesAEnvoyer([], [])).toEqual({ ids: [], valide: true });
  });
});
