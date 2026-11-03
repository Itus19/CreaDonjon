import { describe, expect, it } from "vitest";
import {
  CARD_WIDTH,
  centerOnToday,
  clampSpan,
  detailLevel,
  eraBands,
  graduationStep,
  graduationTicks,
  layoutCards,
  presetView,
  scrollView,
  stepView,
  summarizeView,
  viewLabel,
  viewRange,
  worldExtent,
  xOfYear,
  yearOfX,
  zoomAround,
  zoomFactor,
  type TimelinePoint,
  type View,
} from "./view";

const WORLD = { start: 0, end: 1000 };
const WIDTH = 1110; // zone utile = 890 px (marge 110 de chaque côté)

describe("échelle", () => {
  it("place le bord gauche de la vue à la marge et le bord droit à largeur - marge", () => {
    const view: View = { center: 500, span: 100 };
    expect(xOfYear(450, view, WIDTH)).toBeCloseTo(110);
    expect(xOfYear(550, view, WIDTH)).toBeCloseTo(WIDTH - 110);
    expect(xOfYear(500, view, WIDTH)).toBeCloseTo(WIDTH / 2);
  });

  it("yearOfX est l'inverse de xOfYear", () => {
    const view: View = { center: 320, span: 75 };
    expect(yearOfX(xOfYear(301.5, view, WIDTH), view, WIDTH)).toBeCloseTo(301.5);
  });

  it("viewRange donne le début et la fin de la vue", () => {
    expect(viewRange({ center: 500, span: 100 })).toEqual({ start: 450, end: 550 });
  });
});

describe("bornes de zoom", () => {
  it("n'étend pas sous 20 ans", () => {
    expect(clampSpan(5, 1000)).toBe(20);
    expect(clampSpan(20, 1000)).toBe(20);
  });
  it("n'étend pas au-delà de l'étendue du monde", () => {
    expect(clampSpan(5000, 1000)).toBe(1000);
    expect(clampSpan(1000, 1000)).toBe(1000);
  });
  it("un monde plus petit que 20 ans garde 20 ans", () => {
    expect(clampSpan(500, 8)).toBe(20);
  });
  it("zoomAround respecte les bornes", () => {
    const view: View = { center: 500, span: 22 };
    expect(zoomAround(view, 0.1, 500, WORLD).span).toBe(20);
    const wide: View = { center: 500, span: 900 };
    expect(zoomAround(wide, 10, 500, WORLD).span).toBe(1000);
  });
});

describe("niveau de détail : seuils exacts", () => {
  it("au-dessus de 400 : major seulement", () => {
    expect(detailLevel(400.01)).toBe("major");
    expect(detailLevel(1000)).toBe("major");
  });
  it("400 inclus : major et notable", () => {
    expect(detailLevel(400)).toBe("notable");
  });
  it("130 inclus : major et notable", () => {
    expect(detailLevel(130)).toBe("notable");
  });
  it("sous 130 : tout", () => {
    expect(detailLevel(129.99)).toBe("all");
    expect(detailLevel(20)).toBe("all");
  });
});

describe("graduations", () => {
  it.each([
    [900, 250],
    [800.01, 250],
    [800, 100],
    [301, 100],
    [300, 50],
    [121, 50],
    [120, 10],
    [51, 10],
    [50, 5],
    [20, 5],
  ])("étendue %s -> pas de %s ans", (span, step) => {
    expect(graduationStep(span)).toBe(step);
  });

  it("liste les multiples du pas dans la vue", () => {
    expect(graduationTicks({ center: 100, span: 100 })).toEqual([50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
  });
});

const P = (id: string, year: number, scope: TimelinePoint["scope"] = "major"): TimelinePoint => ({ id, year, scope });

describe("résumé de la vue (niveau, dates cachées, libellé)", () => {
  const points = [P("a", 100, "major"), P("b", 110, "notable"), P("c", 120, "detail"), P("d", 130, "detail"), P("e", 900, "detail")];

  it("compte les dates cachées dans la vue seulement", () => {
    const s = summarizeView(points, { center: 500, span: 500 }); // vue 250..750 -> rien
    expect(s.level).toBe("major");
    expect(s.hiddenCount).toBe(0);
    const t = summarizeView(points, { center: 120, span: 500 }); // vue -130..370, major
    expect(t.hiddenCount).toBe(3);
    expect(t.visibleCount).toBe(1);
  });

  it("niveau notable : cache les détails seulement", () => {
    const s = summarizeView(points, { center: 120, span: 300 });
    expect(s.level).toBe("notable");
    expect(s.hiddenCount).toBe(2);
    expect(s.visibleCount).toBe(2);
  });

  it("niveau tout : rien de caché", () => {
    const s = summarizeView(points, { center: 120, span: 120 });
    expect(s.hiddenCount).toBe(0);
    expect(s.visibleCount).toBe(4);
  });

  it("libellé pur", () => {
    expect(viewLabel(120, "all")).toBe("Vue : 120 ans · tout, jusqu'aux naissances");
    expect(viewLabel(400, "notable")).toBe("Vue : 400 ans · grandes dates et notables");
    expect(viewLabel(900.4, "major")).toBe("Vue : 900 ans · grandes dates seulement");
  });
});

describe("rangement des cartes", () => {
  const view: View = { center: 500, span: 100 }; // 890 px pour 100 ans : 8,9 px/an

  it("alterne dessus et dessous quand les cartes ne se chevauchent pas", () => {
    const pts = [P("a", 455, "detail"), P("b", 475, "detail"), P("c", 495, "detail"), P("d", 515, "detail")];
    // 20 ans = 178 px < 186 : chevauchement entre voisines, mais côtés alternés
    const { cards } = layoutCards(pts, view, WIDTH);
    expect(cards.map((c) => c.side)).toEqual(["above", "below", "above", "below"]);
  });

  it("une date qui ne tient d'aucun côté rejoint un + n autour", () => {
    const pts = [P("a", 500, "detail"), P("b", 501, "detail"), P("c", 502, "detail"), P("d", 503, "detail")];
    const { cards } = layoutCards(pts, view, WIDTH);
    expect(cards.map((c) => c.id)).toEqual(["a", "b"]);
    const total = cards.reduce((n, c) => n + c.more.count, 0);
    expect(total).toBe(2);
    const withMore = cards.find((c) => c.more.count > 0);
    expect(withMore?.more.ids.length).toBe(withMore?.more.count);
    expect(withMore?.more.range).not.toBeNull();
    expect(withMore!.more.range!.start).toBeLessThanOrEqual(502);
    expect(withMore!.more.range!.end).toBeGreaterThanOrEqual(503);
  });

  it("deux cartes assez éloignées prennent le même côté sans conflit", () => {
    const pts = [P("a", 460, "detail"), P("b", 540, "detail")];
    const { cards } = layoutCards(pts, view, WIDTH);
    expect(cards).toHaveLength(2);
    expect(cards[1].x - cards[0].x).toBeGreaterThan(CARD_WIDTH);
  });

  it("ignore ce qui est hors vue ou masqué par le niveau", () => {
    const wide: View = { center: 500, span: 500 }; // niveau major
    const pts = [P("a", 500, "major"), P("b", 510, "detail"), P("c", 5000, "major")];
    const { cards } = layoutCards(pts, wide, WIDTH);
    expect(cards.map((c) => c.id)).toEqual(["a"]);
  });

  it("aucune date perdue : montrée + dans un + n + cachée = dates de la vue", () => {
    const pts: TimelinePoint[] = [];
    const scopes: TimelinePoint["scope"][] = ["major", "notable", "detail"];
    for (let i = 0; i < 60; i++) pts.push(P(`p${i}`, 400 + (i * 37) % 200, scopes[i % 3]));
    for (const span of [20, 60, 130, 400, 1000]) {
      const v: View = { center: 500, span: clampSpan(span, 1000) };
      const { start, end } = viewRange(v);
      const inView = pts.filter((p) => p.year >= start && p.year <= end);
      const { cards } = layoutCards(pts, v, WIDTH);
      const shown = cards.length;
      const inMore = cards.reduce((n, c) => n + c.more.count, 0);
      const hidden = summarizeView(pts, v).hiddenCount;
      expect(shown + inMore + hidden).toBe(inView.length);
    }
  });
});

describe("ères en bandeaux", () => {
  const eras = [
    { name: "Première", startYear: 0 },
    { name: "Deuxième", startYear: 300 },
    { name: "Troisième", startYear: 700 },
  ];

  it("coupe l'ère aux bords de la vue et le nom suit la partie visible", () => {
    const view: View = { center: 250, span: 200 }; // 150..350
    const bands = eraBands(eras, view, WIDTH, 900);
    expect(bands.map((b) => b.name)).toEqual(["Première", "Deuxième"]);
    const first = bands[0];
    expect(first.startYear).toBe(150); // coupée à gauche... de la vue
    expect(first.endYear).toBe(300);
    expect(first.cutLeft).toBe(true);
    expect(first.cutRight).toBe(false);
    expect(first.x0).toBeCloseTo(110);
    expect(first.labelX).toBeCloseTo((first.x0 + first.x1) / 2);
    const second = bands[1];
    expect(second.endYear).toBe(350);
    expect(second.cutRight).toBe(true);
    expect(second.x1).toBeCloseTo(WIDTH - 110);
  });

  it("la dernière ère va jusqu'à aujourd'hui", () => {
    const view: View = { center: 800, span: 400 }; // 600..1000
    const bands = eraBands(eras, view, WIDTH, 850);
    const last = bands[bands.length - 1];
    expect(last.name).toBe("Troisième");
    expect(last.endYear).toBe(850);
    expect(last.cutRight).toBe(false);
  });

  it("omet une ère entièrement hors de la vue", () => {
    const view: View = { center: 100, span: 100 }; // 50..150
    expect(eraBands(eras, view, WIDTH, 900).map((b) => b.name)).toEqual(["Première"]);
  });

  it("trie les ères par année de début", () => {
    const shuffled = [eras[2], eras[0], eras[1]];
    const bands = eraBands(shuffled, { center: 500, span: 1000 }, WIDTH, 900);
    expect(bands.map((b) => b.name)).toEqual(["Première", "Deuxième", "Troisième"]);
  });
});

describe("gestes", () => {
  it("défiler : ±12 % de l'étendue", () => {
    const view: View = { center: 500, span: 100 };
    expect(scrollView(view, 1, WORLD).center).toBeCloseTo(512);
    expect(scrollView(view, -1, WORLD).center).toBeCloseTo(488);
  });

  it("‹ › : ±30 %", () => {
    const view: View = { center: 500, span: 100 };
    expect(stepView(view, 1, WORLD).center).toBeCloseTo(530);
    expect(stepView(view, -1, WORLD).center).toBeCloseTo(470);
  });

  it("le centre reste dans le monde", () => {
    expect(scrollView({ center: 995, span: 400 }, 1, WORLD).center).toBe(1000);
    expect(stepView({ center: 3, span: 400 }, -1, WORLD).center).toBe(0);
  });

  it("facteurs de zoom : molette 1,25 / 0,8 ; boutons 1,6", () => {
    expect(zoomFactor("out", "wheel")).toBe(1.25);
    expect(zoomFactor("in", "wheel")).toBe(0.8);
    expect(zoomFactor("out", "button")).toBe(1.6);
    expect(zoomFactor("in", "button")).toBeCloseTo(1 / 1.6);
  });

  it("zoomer autour d'un point garde ce point à la même abscisse", () => {
    const view: View = { center: 500, span: 200 };
    const anchor = 440;
    const before = xOfYear(anchor, view, WIDTH);
    const next = zoomAround(view, 0.8, anchor, WORLD);
    expect(next.span).toBeCloseTo(160);
    expect(xOfYear(anchor, next, WIDTH)).toBeCloseTo(before);
  });

  it("préréglages", () => {
    const current: View = { center: 300, span: 50 };
    expect(presetView("world", current, WORLD)).toEqual({ center: 500, span: 1000 });
    expect(presetView("era", current, WORLD)).toEqual({ center: 300, span: 400 });
    expect(presetView("century", current, WORLD)).toEqual({ center: 300, span: 130 });
    expect(presetView("life", current, WORLD)).toEqual({ center: 300, span: 60 });
  });

  it("un préréglage plus grand que le monde est borné", () => {
    expect(presetView("era", { center: 50, span: 50 }, { start: 0, end: 100 }).span).toBe(100);
  });

  it("centrer sur aujourd'hui : même étendue, aujourd'hui au quart gauche", () => {
    const view: View = { center: 100, span: 200 };
    const next = centerOnToday(view, 600, WORLD);
    expect(next.span).toBe(200);
    const x = xOfYear(600, next, WIDTH);
    expect(x).toBeCloseTo(110 + (WIDTH - 220) / 4);
  });
});

describe("étendue du monde", () => {
  it("englobe les dates, les ères et aujourd'hui", () => {
    expect(worldExtent([120, 340], [{ name: "x", startYear: 50 }], 400)).toEqual({ start: 50, end: 400 });
  });
  it("garantit au moins 20 ans", () => {
    const e = worldExtent([100], [], 100);
    expect(e.end - e.start).toBeGreaterThanOrEqual(20);
  });
});
