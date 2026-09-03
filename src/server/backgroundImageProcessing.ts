import { availableModesFor, deriveHueChroma, type ThemeMode } from "@/src/core/theme/oklch";

/**
 * Pas de garde `server-only` ici, a la difference du reste de `src/server` :
 * cette fonction n'importe ni Supabase ni Next, seulement `sharp` (un
 * binaire natif Node, de toute facon inutilisable dans un navigateur — le
 * bundler echouerait bruyamment si elle finissait par erreur dans un
 * composant client, sans besoin du garde). Ce choix la rend importable
 * depuis un script autonome (`scripts/compute-builtin-backgrounds.ts`),
 * execute hors du bundler Next via `tsx` — `server-only` y leve une
 * exception a l'import, meme motif deja rencontre et evite pour
 * `scripts/seed-dev.ts` (qui n'importe jamais de module `src/server/**`
 * pour cette raison).
 */

const THUMB_SIZE = 64;

export interface ProcessedBackground {
  thumbDataUrl: string;
  hue: number;
  chroma: number;
  availableModes: ThemeMode[];
}

/**
 * Traitement d'une image de fond (V2-G4 reformule, specs/coquille-et-design.md
 * §2b) : une miniature CARREE et nette (64x64, `fit: cover`) pour la grille
 * de selection des Reglages, ou le recadrage carre est un choix d'icone
 * assume, plus la teinte/chroma OKLCH qui alimentent `--h`/`--c`
 * (tokens.css). Le backdrop plein format n'est PLUS produit ici depuis
 * V2-L1 : `uploadBackgroundImage` (src/server/services/backgroundImages.ts)
 * le televerse separement via l'interface de stockage commune
 * (`storage.ts#uploadAsset`, aspect d'origine preserve, jamais de recadrage
 * carre), qui fait deja son propre redimensionnement/encodage. Reutilisee a
 * l'identique pour un televersement personnel et pour le calcul unique des
 * miniatures des images fournies par l'application
 * (`scripts/compute-builtin-backgrounds.ts` — leur fond, lui, reste servi
 * directement depuis `public/backgrounds/`, jamais retraite).
 */
export async function processBackgroundImage(buffer: Buffer): Promise<ProcessedBackground> {
  // Import dynamique : voir la meme remarque dans entityPortraits.ts —
  // charger `sharp` (binaire natif) ne doit couter qu'a ce traitement, pas a
  // tout module qui lit un fond d'ecran deja calcule.
  const { default: sharp } = await import("sharp");
  const image = sharp(buffer);

  const [thumbBuffer, stats] = await Promise.all([
    image.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" }).webp({ quality: 70 }).toBuffer(),
    image.clone().stats(),
  ]);

  const { hue, chroma } = deriveHueChroma(stats.dominant);

  return {
    thumbDataUrl: `data:image/webp;base64,${thumbBuffer.toString("base64")}`,
    hue,
    chroma,
    availableModes: availableModesFor(hue, chroma),
  };
}
