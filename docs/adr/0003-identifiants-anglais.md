# 0003 — Identifiants techniques en anglais, français dans i18n

**Date :** 2026-07-27
**Statut :** acceptée

## Contexte

Le projet est développé et utilisé en français, mais les données de référence (SRD) et la plupart des outils (Postgres, TypeScript, Supabase) sont pensés en anglais. Il faut décider où vit chaque langue avant que le code ne s'installe dans une convention bâtarde.

## Options envisagées

- **A.** Colonnes, clés et types en français (`nom`, `sort`, `visibilite_niveau`) — lisible pour le développeur seul, mais divergent de tout ce qui vient du SRD et des bibliothèques.
- **B.** Tout en anglais snake_case en base et dans le code ; le français vit uniquement dans `src/i18n/fr.ts` et les tables de traduction (`ruleset_entry_translations`).

## Décision

B. `entry_key` reste `'fireball'`, jamais traduit ni affiché tel quel. Les libellés visibles par l'utilisateur passent par `src/i18n/fr.ts` ou par une traduction `official_srd`/`community`/`machine`/`user` en base.

## Conséquences

- Un import SRD ultérieur (nouvelle édition, contenu tiers) s'aligne sans renommage.
- Toute chaîne française codée en dur ailleurs que `src/i18n/fr.ts` est un signal qu'on a dévié de la convention.
- Coût immédiat : le développeur qui apprend à coder sur ce projet lit des noms de colonnes anglais — compensé par le fait que Postgres, TypeScript et le SRD parlent déjà cette langue.
