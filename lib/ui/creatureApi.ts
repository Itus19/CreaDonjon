import { lireCombat, type CombatCreature } from "@/lib/ui/creature";

/**
 * V3.1-79 — l'appel unique de la fiche de créature : ses instances dans
 * l'initiative en cours (`{ combat: null }` hors combat ou pour un joueur).
 * Sorti du composant : le fichier n'a aucun effet de montage (cliquet du
 * câblage, docs/CABLAGE.md §6). Une réponse en erreur lève : le composant
 * l'écrit dans la console et retombe sur « hors combat », jamais sur des PV
 * inventés.
 */
export async function lireCombatCreature(entityId: string): Promise<CombatCreature | null> {
  const res = await fetch(`/api/entities/${entityId}/creature-combat`);
  if (!res.ok) throw new Error(`creature-combat : ${res.status}`);
  return lireCombat(await res.json());
}
