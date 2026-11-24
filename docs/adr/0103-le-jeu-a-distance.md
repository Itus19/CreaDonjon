# 0103 — Le jeu à distance

**Date :** 2026-11-23
**Statut :** acceptée (choix de l'auteur du 18 et du 23 novembre ; backlog « Backlog du mode à distance », lots AD-)

## Contexte

L'auteur veut jouer par écrit avec un MJ humain et un ou plusieurs joueurs, en direct ou en différé, sur un écran proche du solo. Le MJ demande des jets ; le joueur lance dans l'app ou recopie son dé physique. Un message peut être secret (pour un joueur, ou d'un joueur au MJ).

L'ADR 0058 fixe le mode d'une campagne à la création, et un monde n'a qu'une campagne.

## Options envisagées

1. **Où vit le mode.** A : un troisième mode de campagne. B : **un écran d'une campagne ordinaire**, avec un réglage « Façon de jouer » (à table, à distance, les deux).
2. **Où vit le fil.** A : une table de messages à part. B : **le journal de session** (`session_events`, ADR 0005), avec une colonne de visibilité.
3. **Le DD caché.** A : une colonne dans la demande, masquée par l'écran. B : **une table à part, lisible du MJ seul** : la RLS filtre des lignes, pas des colonnes (règle absolue 5).

## Décision

**1-B, 2-B, 3-B.**

- La façon de jouer est `campaigns.table_settings.play_style` (`table`, `remote`, `both`). Choisie à la création ; changée seulement dans Gestion de campagne, avec confirmation. Elle ne règle que l'affichage : les données sont communes.
- Le MJ humain parle en `narration` / `gm`, le joueur en `player_action` / `player`. `visible_to` : nul = tous ; une liste = ces joueurs ; `'{}'` = le MJ seul. L'administrateur et l'auteur lisent toujours.
- `roll_requests` suit le patron de `save_requests` (ADR 0044) : créée par le MJ, répondue par le joueur visé via `answer_roll_request`. Le serveur lance le d20 ou recopie le dé physique, et calcule le total depuis la fiche (règle 8).
- `session_reads` garde le dernier `seq` lu : « depuis ta dernière visite » et le compteur de l'onglet.
- Le fil privé « MJ » du joueur est le fil privé du chat de campagne (ADR 0038) : aucune table nouvelle.
- Les écrans écoutent `session_events` et `roll_requests` en temps réel, un canal par écran filtré sur la session (QUOTAS Q2, Q3), au lieu de sonder.

## Conséquences

- Correction de sécurité au passage : l'insertion dans `session_events` exige `actor_user_id` nul ou soi-même, et réserve la voix du MJ humain à l'administrateur. Les autres événements `gm` (jets ciblés, sauvegardes refaites en fin de tour) restent ouverts aux membres : le serveur les écrit au nom du joueur qui les déclenche.
- Le total d'une réponse est déclaré par le serveur ; un joueur qui appelle la fonction lui-même peut mentir, comme il peut déjà déclarer un dé physique. Accepté, comme pour `save_requests`.
- Pas de messagerie entre joueurs : un joueur ne restreint un message qu'au MJ.
- Modifier ou retirer un message pendant une heure (backlog) viendra plus tard : le journal reste en ajout seul, une correction sera un nouvel événement.
