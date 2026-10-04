# ADR 0036 — Les données sous la refonte « verre minéral »

**Date** : 4 octobre 2026 · **Statut** : accepté, sauf le point 5 (réglages de campagne) — **proposé, à valider par l'auteur** : il ajoute une colonne à `campaigns` (V3.1-19, points A et B)

## Contexte

L'esquisse de V3.1-19 est décidée, mais plusieurs écrans montrent des valeurs que le code ne range nulle part, ou range ailleurs que là où on les modifie. Lu dans le code le 4 octobre :

- les pièces et l'équipement vivent dans le bloc `inventory` (`currency`, `items[].equipped`) ; la bascule « Équiper » et la monnaie automatique (`depositCoins` / `spendCoins`, `src/core/rules/currency.ts`) **existent déjà** dans `InventoryPanel.tsx`, qui renvoie tout le bloc ;
- les statistiques d'économie (`campaignEconomy.ts`) et le journal d'activité lisent le porte-monnaie **dans les révisions** de l'entité ;
- `entity_runtime_state` porte PV, PV temporaires, dés de vie, épuisement, inspiration (bornée à 5 en dur), XP, ressources, emplacements dépensés, états, jets contre la mort — rien sur la concentration ;
- la concentration n'existe que sur un participant d'initiative (`combat_participants.concentration`, `{ label }`) ;
- `takeShortRest` et `takeLongRest` (`characterActions.ts`) existent, mais n'émettent pas les événements `short_rest` / `long_rest`, pourtant présents dans le vocabulaire des déclencheurs ;
- `death_saves` est stocké mais aucune règle ne le fait avancer ;
- `campaigns` n'a aucune colonne de réglages, à part `target_session_minutes` ;
- le panneau de dés envoie `{ pool, hidden }` : ni modificateur, ni avantage, ni libellé.

## Options et décisions

**1. Pièces et équipement (A1) — restent dans le bloc `inventory`.**
Options : les déplacer dans l'état de jeu, ou les garder dans le bloc. On les garde : l'économie et le journal en dépendent, et ce sont des possessions, pas un état de combat. Ce qui change : la Table et la fiche ne renvoient plus tout le bloc, elles appellent un **service serveur** `changeCurrency(entityId, delta par pièce)` (et `setItemEquipped`) qui relit le bloc, applique `depositCoins` / `spendCoins`, et l'écrit avec contrôle de version, comme `takeLongRest` le fait déjà pour le bloc `character`. Une révision par geste et par personnage : c'est le prix d'une économie lisible, et il est déjà payé aujourd'hui.

**2. Maximum d'inspiration (A2) — un réglage de campagne, pas une règle de ruleset.**
Un ruleset publié est figé (`SCHEMA.md`) : changer ce maximum obligerait à publier une variante. On le range avec les droits des joueurs (point 5), dans Règles actives. `1` par défaut (règle 2024) ; la borne `max(5)` de `zRuntimeState` reste comme garde-fou. `changeInspiration` borne au réglage, côté serveur.

**3. Concentration (A3) — un champ de l'état de jeu.**
`concentration: { spell_key: string | null, label: string } | null`, `.default(null)` dans `zRuntimeState`, sans migration SQL (même précédent que `inspiration` et `pending_request`). Lancer un sort de concentration la pose et remplace la précédente ; « Rompre » la retire. Pendant une initiative, le participant d'un PJ et sa fiche restent synchronisés, comme les états le sont déjà. L'état `concentrating` lu par les déclencheurs est **dérivé** de ce champ au moment de bâtir leur contexte, jamais stocké en double (règle 16).

**4. « Reprendre » et « Consultées récemment » (A4) — dans le navigateur.**
Options : une table serveur (suit le compte d'un appareil à l'autre) ou `localStorage`. On choisit le navigateur : aucune donnée personnelle de plus en base, aucune migration, compatible avec la cible locale. Ce qu'on perd : la liste ne suit pas d'un appareil à l'autre. Lecture et écriture protégées (`try/catch` qui retombe sur une liste vide, jamais silencieux en développement) ; la liste ne garde que des identifiants et des titres, jamais un contenu caché (la visibilité reste résolue par le serveur à l'ouverture).

**5. Réglages de campagne (A2, A5) — une colonne `table_settings jsonb` sur `campaigns`.** _Proposé._
Données froides, lues partout, changées rarement : la place de `target_session_minutes`. Une colonne `jsonb not null default '{}'`, validée par un schéma Zod `zCampaignTableSettings` qui donne les valeurs par défaut : `inspiration_max` (1), et `player_can_edit` à six interrupteurs — `conditions` et `inspiration` faux, `hp`, `currency`, `spell_slots`, `hit_dice` vrais. Une seule migration, mise à jour de `SCHEMA.md` dans le même ticket. Le serveur refuse l'écriture d'un joueur quand l'interrupteur est coupé ; le MJ et le moteur (repos, résolution) ne sont jamais concernés. Détail : V3.1-23.

**6. Résolution depuis l'outil de dés (B6) — un cœur commun extrait du tour solo.**
La résolution (touche contre CA, sauvegarde, dégâts, états, soins) est extraite de `playTurn` en un service partagé ; le solo garde par-dessus l'interprétation et la narration. L'initiative en cours, c'est `combats` et ses participants, qui portent déjà CA, PV, PV temporaires, états. Un jet secret qui touche une cible reste secret (auteur et MJ), mais son effet s'applique. Le reste de la conception est V3.1-21 (Opus). **L'outil de dés ne l'attend pas** : son point d'entrée accepte dès maintenant modificateur, avantage et libellé, et « Cibler » reste grisé jusqu'à V3.1-21.

**7. Repos (B7) — une seule fonction par repos, qui émet son événement.**
`takeShortRest` / `takeLongRest` restent le seul chemin d'un repos — fiche, Table, « Toute la table » (une boucle sur les PJ cochés, un résultat par PJ). Chacun émet `short_rest` / `long_rest` dans `runTriggers` après avoir appliqué ses effets de base. C'est par là que V3.1-5 (Ingénieux) branche l'inspiration, sans code propre à un trait.

**8. Jets contre la mort (B8) — des fonctions pures du noyau, règles 2024.**
Dans `src/core/rules/deathSaves.ts`, tests d'abord :

- dégâts qui laissent à 0 PV → état Inconscient ;
- dégâts restants ≥ PV max → mort directe ;
- dégâts à 0 PV → un échec (deux sur un critique) ;
- jet : 10 ou plus réussit ; 1 compte deux échecs ; 20 rend 1 PV ;
- trois réussites → stabilisé ; trois échecs → mort ;
- tout soin remet les jets à zéro et retire Inconscient.

« Stabilisé » et « mort » se lisent dans `death_saves` (3 réussites, 3 échecs), sans champ de plus.

## Conséquences

- Les points 1, 3, 4, 6 (sans cible), 7 et 8 ne demandent aucune migration : les tickets qui en dépendent peuvent partir à Sonnet.
- Le point 5 ajoute une colonne : il attend l'accord de l'auteur, puis V3.1-23 l'applique. L'Inspiration ▲▼ des joueurs et le réglage du maximum en dépendent.
- Les lots qui changent la monnaie ou l'équipement passent par les nouveaux services, jamais par un renvoi du bloc entier depuis un nouvel écran.
