import { z } from "zod";
import { fenceUntrustedData } from "./promptSafety";

/**
 * V3.2-54 (retour de l'auteur, 27 novembre) — Le portrait d'un PNJ : un
 * premier bloc « Apparence » qui ne décrit que ce qu'on voit (taille,
 * corpulence, âge, cheveux, visage, vêtements, équipement porté, allure),
 * assez riche pour servir tel quel de consigne à un générateur d'images.
 * Ce que le PNJ sait ou cache n'y entre jamais : un détail physique caché
 * (un tatouage sous la manche) part dans un bloc réservé au MJ, à découvrir.
 *
 * L'IA rédige, le code décide (règle 9) : la sortie passe par ce schéma
 * fermé, puis par `ai_proposals` ; l'équipement décrit est celui que le
 * moteur a tiré, jamais une arme inventée.
 */

export const APPEARANCE_LABEL = "Apparence";
export const HIDDEN_LABEL = "Ce qui ne se voit pas";

/** Assez long pour nourrir une image (une centaine de mots), assez court pour rester un portrait. */
const APPEARANCE_MIN = 200;
const APPEARANCE_MAX = 1600;

export const npcPortraitSchema = z
  .object({
    apparence: z.string().trim().min(APPEARANCE_MIN).max(APPEARANCE_MAX),
    cache: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => (v === undefined || v === "" ? undefined : v)),
  })
  .strict();
export type NpcPortrait = z.infer<typeof npcPortraitSchema>;

export const NPC_PORTRAIT_TOOL = "portrait_pnj";

export const npcPortraitToolSchema = {
  type: "object",
  properties: {
    apparence: {
      type: "string",
      description:
        "Un seul paragraphe de 90 à 160 mots, en français, à la troisième personne : uniquement ce qu'on voit, du général au détail.",
    },
    cache: {
      type: "string",
      description: "Facultatif : une phrase, un détail physique que les vêtements ou la posture cachent (tatouage, cicatrice, marque). Jamais un objet ni une arme.",
    },
  },
  required: ["apparence"],
} as const;

export interface NpcPortraitInput {
  /** Le libellé de la fiche (« Aubergiste, d'âge mûr ») : jamais un vrai nom secret. */
  label: string;
  /** Le texte déjà écrit sur le PNJ (bloc Description) : à ne pas contredire. */
  description?: string;
  /** Les objets portés à la vue de tous, tirés par le moteur (`seenAtAGlance`). */
  worn: readonly string[];
  /** Le lieu, pour le registre des vêtements (« une auberge de bourg »). */
  place?: string;
  /** La narration du tour où le PNJ est vu : ce qu'elle a montré de lui entre au portrait. */
  narration?: string;
}

export interface PortraitMessage {
  role: "system" | "user";
  content: string;
}

const SYSTEM = [
  "Tu es portraitiste pour une partie de jeu de rôle médiéval-fantastique. Tu décris l'apparence d'un personnage non joueur, en français.",
  "Décris seulement ce qu'un regard attentif voit, dans cet ordre : âge apparent, taille, corpulence, teint, cheveux (couleur, longueur, coiffure), visage (forme, yeux, nez, rides, cicatrices, pilosité), mains, vêtements (coupe, couleurs, matières, usure), équipement porté, posture et allure.",
  "Sois concret et précis, sans métaphore appuyée : le texte doit pouvoir servir tel quel à un illustrateur.",
  "Décris tous les objets de la liste « porté » et n'ajoute aucune arme, armure ni objet notable qui n'y figure pas.",
  "N'écris jamais son nom, ni son histoire, ni ses pensées, ni ce qu'il cache : seulement l'apparence. Ne contredis ni la description ni le récit fournis ; reprends ce qu'ils montrent de lui.",
  "Dans cache, tu peux proposer un détail physique que l'on ne voit pas au premier regard. Laisse-le vide si rien ne s'impose.",
  `Réponds via l'outil ${NPC_PORTRAIT_TOOL}, une seule fois.`,
].join("\n");

export function buildNpcPortraitMessages(input: NpcPortraitInput): PortraitMessage[] {
  const parts = [
    `Personnage : ${input.label}`,
    input.place ? `Lieu : ${input.place}` : null,
    `Porté, visible de tous : ${input.worn.length > 0 ? input.worn.join(", ") : "Rien de notable"}`,
    input.description?.trim() ? fenceUntrustedData("description", input.description.trim()) : null,
    input.narration?.trim() ? fenceUntrustedData("recit", input.narration.trim()) : null,
  ].filter((p): p is string => p !== null);
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: parts.join("\n\n") },
  ];
}

/** Le libellé d'un bloc (`display.label`), tel que l'éditeur l'affiche ; `null` sans libellé. */
export function blockLabel(block: { display: unknown }): string | null {
  const label = (block.display as { label?: unknown } | null)?.label;
  return typeof label === "string" ? label : null;
}

/** Les trois sortes de note que le récit peut proposer pour une fiche (V3.2-54). */
export const WORLD_NOTE_ASPECTS = ["apparence", "cache", "recit"] as const;
export type WorldNoteAspect = (typeof WORLD_NOTE_ASPECTS)[number];

/**
 * Le bloc texte qui reçoit une note du récit : l'apparence au bloc
 * « Apparence », un détail caché au bloc réservé au MJ ; une note de récit
 * (ou sans aspect) au premier autre bloc texte (`null`).
 */
export function worldNoteBlockLabel(aspect: WorldNoteAspect | undefined): string | null {
  if (aspect === "apparence") return APPEARANCE_LABEL;
  if (aspect === "cache") return HIDDEN_LABEL;
  return null;
}
