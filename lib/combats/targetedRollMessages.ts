import type { TargetedRollErrorReason } from "@/src/server/services/targetedRoll";

/** Les refus d'un jet ciblé, communs à la route du MJ et à celle du joueur (V3.1-107). */
export const TARGETED_ROLL_MESSAGES: Record<TargetedRollErrorReason, { status: number; error: string }> = {
  not_running: { status: 409, error: "Aucun combat en cours." },
  target_not_found: { status: 404, error: "Cible introuvable dans ce combat." },
  actor_not_found: { status: 404, error: "Acteur introuvable." },
  invalid_action: { status: 400, error: "Cette action ne va pas avec ce jet." },
  no_attack: { status: 400, error: "Cette action n'a pas de bonus d'attaque." },
  no_save_data: { status: 400, error: "Ce sort ne déclare pas de sauvegarde." },
  no_formula: { status: 400, error: "Cette action n'a pas de formule de dés." },
  no_slot_available: { status: 409, error: "Plus d'emplacement de ce niveau." },
  not_a_weapon: { status: 400, error: "Cet objet n'est pas une arme." },
  item_not_found: { status: 404, error: "Objet ou sort introuvable sur la fiche." },
  not_a_spellcaster: { status: 400, error: "Ce personnage ne lance pas de sorts." },
  not_found: { status: 404, error: "Fiche introuvable." },
  invalid_target: { status: 422, error: "Cet effet ne peut pas viser cette cible." },
  save_gm_only: { status: 409, error: "Un sort à jet de sauvegarde se résout par le MJ." },
};
