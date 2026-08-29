/**
 * Vocabulaire des pôles/axes de la psyché (V2-H1, specs/psyche-pnj.md).
 * `src/core/**` — aucune dépendance framework (CLAUDE.md règle 14).
 */

export const PERSONALITY_POLE_KEYS = [
  "curiosity_caution",
  "altruism_selfishness",
  "empathy_hardness",
  "impulse_prudence",
  "extraversion_reserve",
  "authority_independence",
] as const;
export type PersonalityPoleKey = (typeof PERSONALITY_POLE_KEYS)[number];

export const RELATIONSHIP_AXIS_KEYS = [
  "trust_distrust",
  "friendship_hostility",
  "respect_contempt",
  "attraction_repulsion",
  "debt_independence",
  "fear_assurance",
  "interest_indifference",
] as const;
export type RelationshipAxisKey = (typeof RELATIONSHIP_AXIS_KEYS)[number];

/** specs/psyche-pnj.md §2 : « ordre ↔ liberté », etc. — pôles moraux/politiques, attachables aussi à une faction. */
export const WORLDVIEW_POLE_KEYS = [
  "order_freedom",
  "mercy_justice",
  "sacred_profane",
  "tradition_progress",
  "individual_collective",
  "wealth_honor",
  "peace_force",
] as const;
export type WorldviewPoleKey = (typeof WORLDVIEW_POLE_KEYS)[number];
