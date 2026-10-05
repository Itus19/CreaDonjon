# ADR 0038 — Le salon de table et les jets dans le chat

**Date** : 5 octobre 2026 · **Statut** : accepté le 5 octobre 2026 (lot i de V3.1-19, chat B ; tranche les deux questions de V3.1-22)

## Contexte

Le chat n'a que des fils privés joueur ↔ MJ : `campaign_chat_messages.thread_user_id` est **non nul** (migration `20260901130001`) et la RLS ne montre un fil qu'à son joueur et au MJ. Les jets vivent dans `dice_rolls`, à part ; leur visibilité ne connaît que `public` et `gm` (MJ seul, migration `20260831090001`), et la table ne garde que le rôle du lanceur (`rolled_by`), pas son compte. L'esquisse décidée veut un salon commun, les jets en cartes dans le fil, et un jet secret de joueur visible de **son auteur et du MJ**.

## Options

1. **Salon** : une table à part, ou la même table avec `thread_user_id` nul pour le salon. **Jets** : écrire un message par jet (double écriture, deux sources de vérité), ou lire `dice_rolls` et l'intercaler au fil par l'heure.
2. **Jet secret d'un joueur** : réutiliser `gm` (l'auteur ne verrait plus son propre jet), ou ajouter un niveau « auteur et MJ ».

## Décision

- **Salon** : même table ; `thread_user_id` devient nullable, `null` = salon. RLS : le salon est lisible et écrivable par tout membre de la campagne ; les fils privés restent tels quels.
- **Jets** : jamais recopiés en message. Le fil lit `dice_rolls` de la campagne et l'intercale par `created_at` ; le temps réel est déjà en place sur les deux tables.
- **Jet secret d'un joueur** : `dice_rolls` gagne `rolled_by_user_id` (posé par le serveur, jamais par le client) et un niveau de visibilité `roller` : lisible du lanceur et du MJ. La RLS filtre ; aucun secret n'est envoyé puis caché.
- **Demande de modification** : retirée (décision de l'auteur) ; le MJ donne ou reprend lui-même le droit d'édition par les octrois. `RequestEditButton` et `relatedEntityId` disparaissent avec le ticket.

## Conséquences

Une migration (nullable, politiques du salon, colonne et niveau de `dice_rolls`), `docs/SCHEMA.md` mis à jour, et des tests RLS : un joueur ne lit jamais le fil privé d'un autre ni le jet `roller` d'un autre. Les anciens messages gardent leur `thread_user_id` : rien à reprendre.
