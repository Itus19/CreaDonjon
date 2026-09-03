/**
 * Interpolation de gabarit de generateur (V1-E2, specs/outils-mj.md §3) :
 * remplace chaque `{cle}` par le texte tire pour cette cle. Meme discipline
 * que `interpolateCascadeResults` (src/core/tables/roll.ts) pour les
 * references de table — une cle sans resultat reste affichee telle quelle
 * plutot que de disparaitre silencieusement ou de faire echouer tout le
 * tirage : un gabarit mal configure doit rester visible pour etre corrige.
 */

const SLOT_REF_RE = /\{([a-zA-Z0-9_-]+)\}/g;

export function renderGeneratorTemplate(template: string, slotTexts: Readonly<Record<string, string>>): string {
  return template.replace(SLOT_REF_RE, (full, key: string) => (key in slotTexts ? slotTexts[key] : full));
}

/**
 * Met en forme les emplacements deja tires pour un emplacement `prose`
 * (V2-J1) — une ligne `cle : texte` par emplacement, encadree ensuite comme
 * donnee (CLAUDE.md regle 8, `fenceUntrustedData`) avant d'entrer dans le
 * prompt. Fonction pure separee de l'appel IA lui-meme : rien ici ne
 * touche au reseau, testable sans fournisseur.
 */
export function formatSlotValuesForPrompt(slotTexts: Readonly<Record<string, string>>): string {
  return Object.entries(slotTexts)
    .map(([key, text]) => `${key} : ${text}`)
    .join("\n");
}
