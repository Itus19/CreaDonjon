# 0044 — Les sauvegardes demandées à la cible

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-39)

## Contexte

Un effet à sauvegarde (Moquerie cruelle) n'est pas lancé par l'auteur : la cible résiste. Il faut demander le jet au joueur de la cible (ou au MJ pour un PNJ), recevoir le résultat, puis appliquer l'effet. Aucun effet ne porte de restriction de cible (`zEffectData`).

## Options envisagées

- **A.** Garder la demande dans `entity_runtime_state.pending_request` (comme le solo) — une seule demande par entité, pas de lecture croisée auteur/cible.
- **B.** Une table `save_requests` : une ligne par demande, lue par l'auteur, la cible et le MJ.

## Décision

B.
- **Table `save_requests`** : `campaign_id`, `combat_id` null, `origin_roll_id` (le jet de l'auteur), `author_user_id`, `target_kind` (`entity` | `participant`), `target_id`, `target_user_id` null (le joueur qui répond ; null = le MJ), `ability`, `dc`, `effect` (jsonb : dégâts et états à appliquer selon réussite ou échec, calculés par le moteur à la demande), `status` (`pending` | `answered` | `cancelled`), `natural` null, `total` null, `answered_by`, horodatages. RLS : lecture par l'auteur, la cible (`target_user_id`) et le MJ ; création par le serveur pour l'auteur ; **réponse** par la cible ou le MJ (une fonction `app.answer_save_request`, qui n'écrit que `natural`/`total`/`status`).
- **Qui applique** : la réponse est traitée par le serveur **au nom de celui qui répond** — le joueur de la cible applique sur **son** PJ, le MJ sur un PNJ ou un participant. Aucun privilège nouveau (pas d'ADR 0041).
- **Restriction de cible** dans `zEffectData` : `target?: { creature_types?: string[]; exclude_creature_types?: string[]; immune_conditions_block?: boolean }`, validée par Zod ; une fonction pure `isValidTarget(effect, target)` refuse avant toute demande (Charme-personne sur un mort-vivant). Les fiches SRD concernées la reçoivent par l'import.
- **Temps réel** : les clients écoutent `save_requests` (RLS respectée) ; la pastille du dé encoché compte les demandes `pending` de l'utilisateur.

## Conséquences

Une table, une fonction, `docs/SCHEMA.md`, tests RLS. Les écrans : bandeau de la cible (lancer, vrai dé avec « modificateur inclus », laisser le MJ), Initiative en combat, Table hors combat (V3.1-38, 34).
