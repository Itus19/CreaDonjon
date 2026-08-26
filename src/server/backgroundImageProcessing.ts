import sharp from "sharp";
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

/** Plus grand cote (largeur ou hauteur) de l'image de fond servie — retour utilisateur : 64x64 (la miniature) suffisait pour la grille mais devenait visiblement pixelise une fois etire plein ecran des que le flou baisse. */
const BACKDROP_MAX_DIMENSION = 1920;
const THUMB_SIZE = 64;

export interface ProcessedBackground {
  thumbDataUrl: string;
  /** Encodee WebP, aspect d'origine preserve (jamais recadree en carre) — servie par sa propre route, jamais embarquee dans le HTML. */
  backdropImage: Buffer;
  hue: number;
  chroma: number;
  availableModes: ThemeMode[];
}

/**
 * Traitement d'une image de fond (V2-G4 reformule, specs/coquille-et-design.md
 * §2b) : produit deux sorties a partir d'un fichier quelconque —
 * - une miniature CARREE et nette (64x64, `fit: cover`) pour la grille de
 *   selection des Reglages, ou le recadrage carre est un choix d'icone
 *   assume ;
 * - une image de fond a l'aspect d'origine PRESERVE (`fit: inside`, jamais
 *   de recadrage carre qui centrerait mal une fois etire plein ecran par le
 *   CSS), plafonnee a `BACKDROP_MAX_DIMENSION` sur son plus grand cote —
 *   assez grande pour rester nette meme flou a zero (`--bg-blur`), sans
 *   conserver le fichier d'origine tel quel.
 * Plus la teinte/chroma OKLCH qui alimentent `--h`/`--c` (tokens.css).
 * Reutilisee a l'identique pour un televersement personnel
 * (`src/server/services/backgroundImages.ts`) et pour le calcul unique des
 * miniatures des images fournies par l'application
 * (`scripts/compute-builtin-backgrounds.ts` — leur fond, lui, reste servi
 * directement depuis `public/backgrounds/`, jamais retraite).
 */
export async function processBackgroundImage(buffer: Buffer): Promise<ProcessedBackground> {
  const image = sharp(buffer);

  const [thumbBuffer, backdropImage, stats] = await Promise.all([
    image.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" }).webp({ quality: 70 }).toBuffer(),
    image
      .clone()
      .resize(BACKDROP_MAX_DIMENSION, BACKDROP_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer(),
    image.clone().stats(),
  ]);

  const { hue, chroma } = deriveHueChroma(stats.dominant);

  return {
    thumbDataUrl: `data:image/webp;base64,${thumbBuffer.toString("base64")}`,
    backdropImage,
    hue,
    chroma,
    availableModes: availableModesFor(hue, chroma),
  };
}
