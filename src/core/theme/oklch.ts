/**
 * Fond d'ecran personnel derivant une teinte (V2-G4 reformule,
 * specs/coquille-et-design.md §2b) : extraction de palette pure, aucune
 * dependance, aucune connaissance d'image ou de reseau — reçoit une
 * couleur RVB deja calculee (par `sharp`, cote appelant) et en derive la
 * teinte/chroma OKLCH a injecter dans `tokens.css` (`--h`/`--c`), plus une
 * verification de contraste par mode.
 *
 * Formules OKLab/OKLCH standard (Björn Ottosson) — https://bottosson.github.io/posts/oklab/
 */

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const clamped = Math.min(1, Math.max(0, v));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

interface OklabColor {
  L: number;
  a: number;
  b: number;
}

function linearRgbToOklab(r: number, g: number, b: number): OklabColor {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** Inverse d'`linearRgbToOklab` — renvoie du RVB LINEAIRE (pas encore encode gamma), suffisant pour une luminance relative WCAG. */
function oklabToLinearRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export interface OklchColor {
  l: number;
  c: number;
  /** Degres, 0-360. */
  h: number;
}

export function rgbToOklch(color: RgbColor): OklchColor {
  const lab = linearRgbToOklab(srgbToLinear(color.r), srgbToLinear(color.g), srgbToLinear(color.b));
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const hRad = Math.atan2(lab.b, lab.a);
  const h = ((hRad * 180) / Math.PI + 360) % 360;
  return { l: lab.L, c, h };
}

export function oklchToRgb(color: OklchColor): RgbColor {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);
  const linear = oklabToLinearRgb(color.l, a, b);
  return {
    r: Math.round(linearToSrgb(linear.r) * 255),
    g: Math.round(linearToSrgb(linear.g) * 255),
    b: Math.round(linearToSrgb(linear.b) * 255),
  };
}

/** Plafond de chroma (§2b) : "l'image teinte, elle ne decide pas" — une couleur tres saturee ne doit jamais dominer les surfaces neutres de la coquille. */
export const MAX_CHROMA = 0.05;

/** Teinte/chroma a injecter dans `--h`/`--c` (tokens.css) depuis une couleur dominante extraite d'une image. */
export function deriveHueChroma(dominant: RgbColor): { hue: number; chroma: number } {
  const { h, c } = rgbToOklch(dominant);
  return { hue: Math.round(h), chroma: Math.min(c, MAX_CHROMA) };
}

export type ThemeMode = "dark" | "dim" | "soft" | "light";
export const THEME_MODES: readonly ThemeMode[] = ["dark", "dim", "soft", "light"];

/**
 * Copie figee des `L` de `--bg`/`--ink` par mode (`src/styles/tokens.css`)
 * — seule chose necessaire au calcul de contraste ci-dessous. Le fichier
 * CSS reste l'unique source de verite visuelle ; si ces valeurs changent
 * un jour, les mettre a jour ici aussi (aucun mecanisme de generation
 * partagee entre CSS et TS dans ce depot, hors perimetre de ce ticket).
 */
export const MODE_LIGHTNESS: Record<ThemeMode, { bg: number; ink: number }> = {
  dark: { bg: 0.17, ink: 0.95 },
  dim: { bg: 0.24, ink: 0.94 },
  soft: { bg: 0.74, ink: 0.11 },
  light: { bg: 0.95, ink: 0.1 },
};

function relativeLuminance(rgb: RgbColor): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: RgbColor, b: RgbColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_THRESHOLD = 4.5;

/**
 * Modes dont `--bg`/`--ink` restent lisibles (>= 4.5:1, seuil WCAG AA
 * texte) une fois `hue`/`chroma` appliques. Filet de securite plutot
 * qu'un mecanisme cense rejeter souvent : `--h`/`--c` ne pilotent jamais
 * la clarte `L` des surfaces dans `tokens.css` (deja verifie >= 7:1 a
 * chroma fixe), et le chroma reste plafonne bas (`MAX_CHROMA`) — les
 * quatre modes passeront donc presque toujours ce controle avec
 * l'architecture actuelle des jetons ; ce n'est pas un defaut de cette
 * fonction, c'est la garantie que la coquille etait deja censee offrir.
 */
export function availableModesFor(hue: number, chroma: number): ThemeMode[] {
  return THEME_MODES.filter((mode) => {
    const { bg, ink } = MODE_LIGHTNESS[mode];
    const bgRgb = oklchToRgb({ l: bg, c: chroma, h: hue });
    const inkRgb = oklchToRgb({ l: ink, c: chroma * 0.16, h: hue }); // --ink porte un chroma bien plus faible que --bg dans tokens.css (ex. 0.008 contre 0.022)
    return contrastRatio(bgRgb, inkRgb) >= CONTRAST_THRESHOLD;
  });
}
