/**
 * La teinte d'une case de la matrice des probabilités (V3.1-46) : un spectre
 * CONTINU du rouge (peu de chances) au vert (presque sûr), jamais trois
 * paliers. On interpole dans l'espace OKLCH entre les deux jetons de la
 * charte, `--danger` (oklch 0.62 0.16 25) et `--success` (oklch 0.62 0.16
 * 140) : même clarté, même chroma, seule la teinte tourne de 25 à 140. Deux
 * pourcentages voisins (50 % et 51 %) ont donc deux teintes différentes.
 *
 * Le fond et le chiffre mêlent cette teinte aux jetons du mode (`--panel`,
 * `--ink`) par `color-mix(in oklab, …)` : le chiffre s'assombrit de lui-même
 * en mode clair et s'éclaircit en mode sombre, ce qui garde le contraste AA
 * dans les quatre modes (vérifié par le test, d'après `src/styles/tokens.css`).
 * Le mélange se fait en OKLab, pas en OKLCH : le panneau, presque gris, prend
 * la teinte du fond du monde, et un mélange en OKLCH ferait tourner le rouge
 * vers elle (violet sur un fond violacé). En OKLab, un gris ne change pas la
 * teinte, il l'atténue seulement.
 */

/** Les deux jetons de la charte, tels que `tokens.css` les déclare (identiques dans tous les modes). */
export const DANGER = { l: 0.62, c: 0.16, h: 25 } as const;
export const SUCCESS = { l: 0.62, c: 0.16, h: 140 } as const;

/** Part de la teinte dans le fond de la case et dans le chiffre. */
export const PART_FOND = 45;
export const PART_CHIFFRE = 20;

/** La teinte d'une probabilité (0 à 1, bornée), en OKLCH. */
export function teinte(probabilite: number): { l: number; c: number; h: number } {
  const p = Math.min(1, Math.max(0, probabilite));
  return {
    l: DANGER.l + (SUCCESS.l - DANGER.l) * p,
    c: DANGER.c + (SUCCESS.c - DANGER.c) * p,
    h: DANGER.h + (SUCCESS.h - DANGER.h) * p,
  };
}

function oklch(t: { l: number; c: number; h: number }): string {
  return `oklch(${t.l.toFixed(3)} ${t.c.toFixed(3)} ${t.h.toFixed(2)})`;
}

/** Les deux couleurs CSS d'une case : fond et chiffre. */
export function couleursCase(probabilite: number): { fond: string; chiffre: string } {
  const t = oklch(teinte(probabilite));
  return {
    fond: `color-mix(in oklab, ${t} ${PART_FOND}%, var(--panel))`,
    chiffre: `color-mix(in oklab, ${t} ${PART_CHIFFRE}%, var(--ink))`,
  };
}
