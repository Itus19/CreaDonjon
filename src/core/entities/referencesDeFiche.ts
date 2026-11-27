import { zCharacterBlockData } from "../schemas/blocks/character";
import { zInventoryBlockData } from "../schemas/blocks/inventory";
import { zSpellcastingBlockData } from "../schemas/blocks/spellcasting";
import type { BlockReference } from "../schemas/blocks/reference";

/**
 * V3.2-72 — Les règles et fiches citées par les blocs de fiche d'un
 * personnage (`character`, `inventory`, `spellcasting`), pour que la page du
 * wiki en lecture les montre par leur NOM. Ces blocs ne portent que des clés
 * (« fighter », « greatsword ») et des identifiants : sans cette résolution,
 * la page du wiki d'un PJ n'affichait que les titres des blocs.
 *
 * Pure : la donnée d'un bloc illisible (ancienne forme, champ manquant) ne
 * cite rien, plutôt que de faire échouer toute la page.
 */
export function referencesDeFiche(blockType: string, data: unknown): { ruleKeys: string[]; entityIds: string[] } {
  const refs: BlockReference[] = [];
  if (blockType === "character") {
    const parsed = zCharacterBlockData.safeParse(data);
    if (parsed.success) {
      const c = parsed.data;
      if (c.species) refs.push(c.species);
      if (c.background) refs.push(c.background);
      for (const cl of c.classes) {
        refs.push(cl.class);
        if (cl.subclass) refs.push(cl.subclass);
      }
    }
  } else if (blockType === "inventory") {
    const parsed = zInventoryBlockData.safeParse(data);
    if (parsed.success) for (const item of parsed.data.items) if ("ref" in item) refs.push(item.ref);
  } else if (blockType === "spellcasting") {
    const parsed = zSpellcastingBlockData.safeParse(data);
    if (parsed.success) for (const spell of parsed.data.known) refs.push(spell.ref);
  }
  return {
    ruleKeys: [...new Set(refs.flatMap((r) => (r.kind === "rule" ? [r.key] : [])))],
    entityIds: [...new Set(refs.flatMap((r) => (r.kind === "entity" ? [r.id] : [])))],
  };
}
