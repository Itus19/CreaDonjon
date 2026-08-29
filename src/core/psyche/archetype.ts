import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "./keys";

/**
 * Archetype visuel du bloc `personality` (V2-H1) : nom + couleur derives
 * des deux poles les plus marques, decision prise avec l'utilisateur
 * (docs/adr/0013-tables-psyche-pnj.md) — pas un alignement moral D&D,
 * juste les traits de temperament dominants. `colorVar` reference un nom
 * de variable CSS (src/styles/tokens.css), jamais une couleur en dur
 * (specs/coquille-et-design.md §2).
 */

interface PoleDirection {
  label: string;
  colorVar: string;
}

const POLE_DIRECTIONS: Record<PersonalityPoleKey, { positive: PoleDirection; negative: PoleDirection }> = {
  curiosity_caution: {
    positive: { label: "Curieux", colorVar: "--pole-curiosity" },
    negative: { label: "Prudent", colorVar: "--pole-caution" },
  },
  altruism_selfishness: {
    positive: { label: "Altruiste", colorVar: "--pole-altruism" },
    negative: { label: "Égoïste", colorVar: "--pole-selfishness" },
  },
  empathy_hardness: {
    positive: { label: "Empathique", colorVar: "--pole-empathy" },
    negative: { label: "Impitoyable", colorVar: "--pole-hardness" },
  },
  impulse_prudence: {
    positive: { label: "Impulsif", colorVar: "--pole-impulse" },
    negative: { label: "Réfléchi", colorVar: "--pole-prudence" },
  },
  extraversion_reserve: {
    positive: { label: "Extraverti", colorVar: "--pole-extraversion" },
    negative: { label: "Réservé", colorVar: "--pole-reserve" },
  },
  authority_independence: {
    positive: { label: "Autoritaire", colorVar: "--pole-authority" },
    negative: { label: "Indépendant", colorVar: "--pole-independence" },
  },
};

export interface PersonalityArchetype {
  name: string;
  colorVar: string;
}

const NEUTRAL_ARCHETYPE: PersonalityArchetype = { name: "Équilibré", colorVar: "--pole-neutral" };

/** Bande neutre de specs/psyche-pnj.md §1.5 : un pole a -11..+11 ne compte pour rien dans l'archetype. */
const NEUTRAL_THRESHOLD = 11;

export function archetypeFor(poles: Partial<Record<PersonalityPoleKey, number>>): PersonalityArchetype {
  const marked = PERSONALITY_POLE_KEYS.map((key) => ({ key, value: poles[key] ?? 0 }))
    .filter((entry) => Math.abs(entry.value) > NEUTRAL_THRESHOLD)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (marked.length === 0) return NEUTRAL_ARCHETYPE;

  const direction = (value: number, key: PersonalityPoleKey) =>
    value > 0 ? POLE_DIRECTIONS[key].positive : POLE_DIRECTIONS[key].negative;

  const top = direction(marked[0].value, marked[0].key);
  if (marked.length === 1) return { name: top.label, colorVar: top.colorVar };

  const second = direction(marked[1].value, marked[1].key);
  return { name: `${top.label} et ${second.label.toLowerCase()}`, colorVar: top.colorVar };
}
