import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { couleursCase, PART_CHIFFRE, PART_FOND, teinte } from "./teinteProbabilite";

/**
 * V3.1-46 — « contraste AA du chiffre dans les quatre modes ». Le contraste
 * se calcule ici comme le navigateur le ferait : jetons lus dans
 * `src/styles/tokens.css`, panneau translucide posé sur le fond du mode,
 * `color-mix(in oklab)` (composantes L, a, b linéaires), puis luminance WCAG. Approximation assumée : sous le panneau, on
 * compte le fond uni du mode, pas l'image floutée éventuelle.
 */

type Lch = { l: number; c: number; h: number };
type Rgb = [number, number, number];

function lchVersRgb({ l, c, h }: Lch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as Rgb;
}

function rgbVersLch(rgb: Rgb): Lch {
  const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** `color-mix(in oklab, x p%, y)` : L, a et b linéaires. */
function melange(x: Lch, part: number, y: Lch): Lch {
  const t = part / 100;
  const ab = (c: Lch) => [c.c * Math.cos((c.h * Math.PI) / 180), c.c * Math.sin((c.h * Math.PI) / 180)];
  const [xa, xb] = ab(x);
  const [ya, yb] = ab(y);
  const a = ya + (xa - ya) * t;
  const b = yb + (xb - yb) * t;
  return { l: y.l + (x.l - y.l) * t, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((u, v) => v - u);
  return (x + 0.05) / (y + 0.05);
}

/** Les jetons `--bg`, `--panel` (avec son alpha) et `--ink` de chaque mode, lus dans tokens.css. */
function jetons(mode: string, h: number): { bg: Lch; panel: Lch; alpha: number; ink: Lch } {
  const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");
  const debut = css.indexOf(`:root[data-mode="${mode}"]`);
  const bloc = css.slice(debut, css.indexOf("}", debut));
  const c = 0.022;
  const lire = (nom: string) => {
    const m = new RegExp(`--${nom}:\\s*oklch\\((.*)\\);`).exec(bloc);
    if (!m) throw new Error(`--${nom} absent du mode ${mode}`);
    const [couleur, alpha] = m[1].split("/").map((x) => x.trim());
    const [l, cc, hh] = couleur.split(/\s+/).map((v) => (v === "var(--c)" ? c : v === "var(--h)" ? h : Number(v)));
    return { lch: { l, c: cc, h: hh }, alpha: alpha === undefined ? 1 : Number(alpha) };
  };
  const panel = lire("panel");
  return { bg: lire("bg").lch, panel: panel.lch, alpha: panel.alpha, ink: lire("ink").lch };
}

describe("teinte", () => {
  it("50 % et 51 % ont deux teintes différentes (spectre continu, pas de paliers)", () => {
    expect(teinte(0.5).h).not.toBe(teinte(0.51).h);
    expect(couleursCase(0.5).fond).not.toBe(couleursCase(0.51).fond);
  });

  it("va du jeton danger (0 %) au jeton succès (100 %), bornée hors de [0, 1]", () => {
    expect(teinte(0)).toEqual({ l: 0.62, c: 0.16, h: 25 });
    expect(teinte(1).h).toBeCloseTo(140);
    expect(teinte(-1)).toEqual(teinte(0));
    expect(teinte(2)).toEqual(teinte(1));
  });
});

describe("contraste du chiffre (AA, 4,5:1)", () => {
  for (const mode of ["dark", "dim", "soft", "light"]) {
    // La teinte `--h` suit l'image de fond du monde : on en essaie plusieurs, pas seulement la valeur par défaut (152).
    it.each([30, 152, 280])(`mode ${mode}, teinte du fond %i : tout pourcentage, de 0 à 100 %%`, (h) => {
      const { bg, panel, alpha, ink } = jetons(mode, h);
      const [pr, bgr] = [lchVersRgb(panel), lchVersRgb(bg)];
      const panneauPose = rgbVersLch(pr.map((v, i) => v * alpha + bgr[i] * (1 - alpha)) as Rgb);
      let pire = Infinity;
      for (let p = 0; p <= 100; p++) {
        const t = teinte(p / 100);
        const fond = lchVersRgb(melange(t, PART_FOND, panneauPose));
        const chiffre = lchVersRgb(melange(t, PART_CHIFFRE, ink));
        pire = Math.min(pire, contraste(fond, chiffre));
      }
      expect(pire).toBeGreaterThanOrEqual(4.5);
    });
  }
});
