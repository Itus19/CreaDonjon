# 0030 — Écrire dans le ruleset actif d'un monde ne devrait pas être réservé à son créateur

**Date :** 2026-09-27
**Statut :** proposée

## Contexte

En testant « Créer une sous-classe » (V2-N1) en conditions réelles — une session
connectée à Valdoria par un lien d'invitation MJ, donc sous un compte différent
de celui du propriétaire du monde — le formulaire refuse d'écrire alors que le
monde a bien une variante active (« Livres personnels (DnD 2024) »).

La cause ne s'arrête pas au client. `ruleset_entries_write` et `rulesets_write`
(`20260730150001_rls.sql:212-217`) s'appuient sur `app.owns_ruleset`, qui se
résume à `created_by = auth.uid()` (`20260730150001_rls.sql:68-72`) : **écrire
une entrée de règle est réservé, en base, au compte qui a créé ce ruleset** —
aucune exception pour un autre membre du même monde. La migration le pose
elle-même comme un choix de périmètre, pas un oubli : *« La RLS filtre par
appartenance au monde. Elle ne distingue pas encore MJ et joueur au sein d'une
campagne (…) Ne pas ouvrir l'application à des joueurs tiers avant la fin de la
Phase 2. »* (`20260730150001_rls.sql:3-7`).

Depuis, `app.is_world_admin` (`20260902150002_row_security_off_permission_helpers.sql:33-44`)
a justement comblé cette distinction ailleurs — propriétaire du monde, membre
`world_members.role in ('owner','editor')`, ou `campaign_members.role = 'gm'` —
et sert déjà de garde d'écriture MJ sur une bonne quinzaine de tables
(`session_journal`, `dice_rolls`, `scene_states`, `map_region_reveals`,
`radio_stations`…). Les rulesets sont restés sur l'ancien idiome, antérieur à
cette fonction.

## Options envisagées

- **A. Ne rien changer.** Toute saisie de règle doit se faire depuis le compte
  qui a créé la variante active — en pratique, un seul MJ par monde peut
  utiliser les formulaires « Ajouter une règle ». Cohérent avec le
  fonctionnement solo actuel (CLAUDE.md : « un outil personnel… il sert son
  auteur et sa table de jeu »), mais bloque tout collaborateur invité en MJ, et
  contredit la lecture (`can_read_ruleset` autorise déjà tout membre du
  monde/campagne à *lire* le ruleset actif — l'écriture, elle, reste plus
  étroite que la lecture qu'elle prolonge).
- **B. Étendre `owns_ruleset` avec `app.is_world_admin`.** Un nouveau
  `app.can_write_ruleset(p_ruleset)`, miroir de `can_read_ruleset` mais avec
  `is_world_admin` au lieu de `is_world_member` : autorise l'écriture si
  `created_by = auth.uid()` **ou** si le ruleset est le ruleset actif d'un
  monde/d'une campagne dont l'appelant est administrateur MJ. Ne s'appliquerait
  qu'à `ruleset_entries_write`/`entry_blocks_write` (le contenu des règles) —
  `rulesets_write` (renommer/supprimer la variante elle-même, changer son
  `content_origin`) resterait au seul créateur, gestes plus rares et plus
  définitifs. Réutilise un mécanisme déjà éprouvé sur quinze tables plutôt que
  d'en inventer un nouveau.
- **C. Octroi explicite par ruleset**, sur le modèle d'`entity_grants`
  (ADR 0024) : le créateur d'une variante partage explicitement le droit
  d'écrire avec tel ou tel compte. Plus fin que B (portée par ruleset, pas par
  monde entier), mais demande une table, un écran de gestion et un choix
  supplémentaire à l'auteur à chaque variante créée — un coût que rien
  n'indique nécessaire ici : un monde n'a qu'un ruleset actif à la fois, et
  `is_world_admin` couvre déjà « qui a le droit de trancher pour ce monde »
  partout ailleurs.

## Décision

**Pas encore tranchée.** L'option B est recommandée : elle aligne l'écriture
sur la lecture (déjà ouverte à tout membre du monde/de la campagne qui utilise
ce ruleset), réutilise `is_world_admin` sans construire de mécanisme parallèle,
et laisse `rulesets_write` intact pour les gestes de gestion de variante. Reste
à confirmer que « MJ du monde » est bien le bon périmètre (et pas, par
exemple, restreint au seul créateur de la variante *plus* le propriétaire du
monde) avant d'écrire la migration.

## Conséquences

- Tant que non tranché : les formulaires « Ajouter une règle »
  (`CreateHomebrewSubclassForm.tsx` et les quatre autres de la même famille)
  et l'import JSON « Ajouter à la variante active » (`RulesetSelector.tsx`)
  ne fonctionnent que depuis le compte qui a créé la variante active — un
  MJ invité par lien ne peut pas les utiliser, même avec un accès MJ complet
  par ailleurs.
- Si B est retenu : une migration RLS (nouvelle fonction + policies mises à
  jour), et une vérification que `listSelectableRulesetsForCurrentUser`
  (volontairement plus étroit, `repos/rules.ts:49-56`) n'a pas besoin du même
  élargissement — c'est un sélecteur de *bascule* (quel ruleset activer),
  pas un contrôle d'écriture ; le confondre avec `can_write_ruleset`
  polluerait la liste avec des variantes d'autrui, exactement ce que son
  commentaire actuel dit vouloir éviter.
- Si B est retenu : `GET /api/worlds/[worldSlug]/ruleset` doit aussi renvoyer
  le détail du ruleset actif indépendamment de `options` (il peut appartenir à
  un autre compte), sans quoi les formulaires resteraient bloqués côté client
  même une fois l'écriture RLS ouverte.
