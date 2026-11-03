# 0073 — Les effets qui durent se rangent par instance de combat

**Date :** 2026-11-03
**Statut :** acceptée (choix de l'auteur, V3.1-130)

## Contexte

L'ADR 0060 range un effet qui dure (« Effrayé » d'Abjuration d'ennemis) dans `entity_active_effects`, une ligne par **entité**. Or la cible typique d'une activation est un monstre en combat : un monstre du SRD n'a pas de fiche d'entité, et les instances d'une même créature du wiki partagent la leur — un Effrayé sur « Gobelin 1 » toucherait les quatre. Et un joueur pose l'effet sur un monstre qu'il n'a pas le droit d'écrire (ADR 0040).

## Options envisagées

- **A. Par instance** : la table accepte aussi une instance de combat (`combat_participant_id`), l'une des deux est requise ; un joueur la pose par le changement signé (ADR 0041), étendu aux effets.
- **B. États seulement** sur un monstre, sans durée suivie : le MJ retire à la main.
- **C. Découper** : le 130 sur soi et les personnages ; les monstres plus tard.

## Décision

**A.**

- Un personnage joueur (fiche `character`) porte ses effets par son **entité**, en combat ou non : ils le suivent d'une scène à l'autre. Toute autre créature en combat les porte par son **instance**.
- `entity_active_effects` : `entity_id` devient facultatif, `combat_participant_id` apparaît (supprimé avec l'instance), exactement l'un des deux est rempli. `source_kind` gagne `feature`, `payload jsonb` reçoit la description validée par Zod (états, fins, jeton, ancrage). `modifiers` garde les modificateurs **déclarés**, `duration` le temps restant.
- **Droits** : une ligne d'entité suit `app.can_edit_entity` (inchangé) ; une ligne d'instance se lit et s'écrit par l'administrateur du monde seulement, comme `combat_participants`.
- **Au nom d'un joueur** : `apply_engine_change` gagne deux genres, `effect_add` (poser un effet sur une instance ou une fiche de la campagne) et `effect_remove` (retirer un effet d'une ligne de la campagne). Mêmes refus que les autres changements signés.

## Conséquences

- Chaque instance a ses effets ; leur expiration est automatique pour tous.
- Une migration réécrit `apply_engine_change` (une migration appliquée ne se modifie pas) ; `zEngineChange` suit.
- Un effet posé sur un monstre ne survit pas au combat (supprimé avec l'instance) : c'est voulu, l'instance est l'adversaire de CE combat.
