# 0040 — L'initiative se ferme aux joueurs, une vue filtrée la leur rouvre

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-37)

## Contexte

`combats` et `combat_participants` ont gardé la RLS de la « Phase 0 » : tout membre du monde lit et écrit les deux tables (`20260818120001_combats.sql`). **Les routes `/api/campaigns/[id]/combats/**` ne vérifient pas non plus que l'appelant est MJ** (lu le 9 octobre) : un joueur peut, par l'API, lire les PV et la CA des adversaires et modifier le combat. Les joueurs doivent pourtant voir l'ordre, le tour, et lancer leur initiative.

## Options envisagées

- **A.** Garder la lecture ouverte et masquer à l'écran — contraire à la règle 5.
- **B.** Fermer les tables au MJ ; servir aux joueurs une **vue filtrée** calculée en base par une fonction `security definer`, et leur ouvrir une seule écriture étroite (leur propre initiative).

## Décision

B.
- **RLS** : `combats` lisible des membres (statut, round, tour : rien de secret, et c'est le signal temps réel), écrit par `app.is_world_admin` ; `combat_participants` lu et écrit par `app.is_world_admin` seulement.
- **Routes** : chaque route de combat vérifie `isWorldAdmin` et répond 403 avant toute écriture (défense en profondeur, en plus de la RLS).
- **Vue joueur** : `app.combat_player_view(p_combat uuid)`, `security definer`, `row_security = off`, qui vérifie d'abord que l'appelant est membre de la campagne, puis renvoie par participant : `id`, `label` (le nom affiché, jamais `rule_key` ni le nom de l'entité d'un adversaire), `initiative`, l'ordre, `is_current`, `side` (allié / adversaire), les **états** ; pour un allié (PJ ou `is_ally`) : PV courants, max, temporaires ; pour un adversaire : un **état de blessure** calculé en base (Indemne ≥ max, Blessé > ½, En sang > 0, Hors de combat 0) ; **jamais de CA adverse**. Un service `getPlayerCombatView` et une route `GET` (Zod) l'exposent.
- **Initiative des joueurs** : un statut `rolling` (« jets d'initiative ») entre `draft` et `running` — **changement du `check` de `combats.status`, migration et `docs/SCHEMA.md`**. Une fonction `app.set_own_initiative(p_participant uuid, p_value int)` n'écrit que l'initiative d'un participant dont le PJ est réclamé par l'appelant (`campaign_characters.user_id`), seulement en statut `rolling`, valeur bornée (−10 à 40). Le chemin « lancer » tire côté serveur (règle 8) puis appelle la fonction ; le chemin « vrai dé » reçoit le naturel et le serveur ajoute le modificateur. Un joueur qui appellerait la fonction à la main ne peut rien de plus qu'annoncer un dé, ce que la règle permet déjà (« annoncé à la main », V3-B5).
- **Temps réel** : les joueurs écoutent les changements de leur ligne `combats` (déjà lisible) et relisent la vue ; le MJ touche `combats.updated_at` à chaque changement de participant.
- Chaque invitation, jet, saisie du MJ et fin confirmée écrit un `session_events` de genre `combat`.

## Conséquences

Une migration (politiques, `check`, deux fonctions), `docs/SCHEMA.md`, tests RLS. Le solo n'est pas touché (le joueur y est propriétaire du monde). Les écrans joueur (V3.1-38) ne lisent jamais `combat_participants` directement. Les écritures du moteur **au nom d'un joueur** sur un adversaire (cibler, V3.1-21) ne passent plus : voir l'ADR 0041.
