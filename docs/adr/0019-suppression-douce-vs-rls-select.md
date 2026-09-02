# 0019 — Une politique SELECT qui masque une ligne bloque sa propre suppression douce

**Date :** 2026-09-02
**Statut :** acceptée

## Contexte

Retour utilisateur : impossible de supprimer certaines fiches (ex. « L'Ancre Rouillée ») — 500 systématique, « new row violates row-level security policy for table "entities" ». Reproduit sur N'IMPORTE quelle fiche, y compris une toute neuve, vide, sans blocs. Un correctif antérieur (commit `a718877`, retirer `.select()` de `softDeleteEntity` pour éviter un conflit RETURNING) n'avait pas réglé le fond du problème — juste déplacé le symptôme.

Diagnostic en plusieurs étapes, chacune isolée en direct avec de vraies sondes SQL (jamais seulement une relecture du code) :
1. Retirer le garde-fou redondant de `app.can_edit_entity` : aucun effet.
2. `set row_security = off` sur `can_edit_entity`/`is_world_admin`/`entity_world_id` : aucun effet.
3. Rendre `entities_update` totalement permissif (`using(true) with check(true)`) : **aucun effet non plus** — la preuve que le blocage ne venait pas de cette politique.
4. Désactiver entièrement la RLS sur `entities` (`alter table entities disable row level security`) : **ça, oui, a résolu le problème.**

## La vraie cause

Postgres exige, pour un `UPDATE`, que la ligne **résultante** (post-modification) satisfasse aussi la politique **SELECT** de la table — pas seulement la politique UPDATE elle-même. `entities_select` exige `deleted_at is null` ; poser `deleted_at = now()` rend donc la ligne invisible pour cette politique, et Postgres refuse l'écriture entière, quelle que soit la politique UPDATE (même `using(true) with check(true)`).

C'est un conflit **structurel**, pas un bug de logique dans `can_edit_entity` : toute table dont la politique SELECT masque les lignes « supprimées » entre en conflit avec une suppression douce faite par un simple `UPDATE ... SET deleted_at = now()`, indépendamment de la politique UPDATE. Aucun ajustement côté client (`.select()`, `count`, RETURNING ou pas) n'y change quoi que ce soit — ce n'était pas la vraie cause du problème initial, contrairement à ce que le premier correctif (`a718877`) avait supposé.

## Décision

La suppression douce d'une ligne dont la politique SELECT dépend de `deleted_at` passe par une fonction Postgres dédiée (`public.soft_delete_entity`, RPC), `security definer` + `set row_security = off` — elle contourne ce conflit structurel pour cette seule écriture, en vérifiant le droit d'édition explicitement à l'intérieur (`app.can_edit_entity`, jamais relâché). Jamais un `.update()` direct depuis le client pour ce genre de colonne.

**Emplacement de la fonction — un piège annexe rencontré en route** : PostgREST n'expose que les fonctions du schéma `public`, jamais celles du schéma interne `app` (utilisé partout ailleurs pour les seuls helpers RLS, jamais appelés directement par le client). Une fonction que le CLIENT doit appeler via `supabase.rpc()` doit donc vivre dans `public`, pas `app` — première fonction de ce genre dans ce projet, toutes les autres `app.*` n'étant consultées qu'automatiquement par Postgres à l'intérieur des politiques RLS.

## Conséquences

- Toute future suppression douce (une autre table qui adopterait `deleted_at`) doit suivre le même patron : une RPC `security definer set row_security = off`, jamais un `.update()` direct si la table a une politique SELECT qui filtre sur cette même colonne.
- Repère de diagnostic pour la prochaine fois : `using(true) with check(true)` sur la politique suspectée est un test d'isolation rapide et fiable — si l'erreur persiste malgré une politique totalement permissive, la cause est ailleurs (ici, la politique SELECT), jamais dans la politique qu'on vient de rendre permissive.
- `blocks`/`relations` (et toute autre table avec `deleted_at` ou un filtre de visibilité similaire dans sa politique SELECT) n'ont pas ce problème aujourd'hui car aucune n'a de suppression douce de ce genre — à revisiter avec le même patron si l'une en acquiert une.
