# 0005 — Journal de session en ajout seul

**Date :** 2026-07-30
**Statut :** acceptée

## Contexte

Une partie (surtout en solo, sans MJ humain pour arbitrer) doit pouvoir reprendre à un état cohérent, et il doit être possible d'auditer ce qu'une IA a réellement fait pendant une séance. Un état muté en place ne permet ni l'un ni l'autre.

## Options envisagées

- **A.** `entity_runtime_state` mis à jour directement à chaque action (PV, conditions...) — simple, mais aucune trace de comment on est arrivé là, et annuler un tour est impossible proprement.
- **B.** `session_events` en ajout seul (jamais d'`UPDATE` ni de `DELETE`), chaque `kind` (`player_action`, `narration`, `roll`, `rule_application`, `world_update`, `note`, `system`) horodaté et séquencé (`unique(session_id, seq)`) ; l'état courant (`entity_runtime_state`) reste une vue de travail, mutable, mais reconstructible depuis le journal.

## Décision

B. Annuler un tour ajoute un événement de compensation, il ne supprime rien. La durée des effets actifs (`entity_active_effects`) s'ancre sur des événements de session plutôt que sur des horodatages réels — « trois rounds » n'a de sens que dans le journal, pas en temps réel.

## Conséquences

- Débogage d'une partie solo possible après coup : on rejoue le journal, on voit exactement ce que l'IA a proposé et appliqué.
- Volume qui croît sans jamais se compacter en V1 — acceptable, le coût de stockage est négligeable face à la valeur d'audit.
- Toute mutation de jeu (équiper, dépenser, perdre des PV) écrit un `session_event`, jamais une `entity_revision` — sinon l'historique éditorial du wiki serait noyé sous des micro-mutations de jeu (specs/wiki-blocs.md §4.5).
