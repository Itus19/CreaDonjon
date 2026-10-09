# 0050 — Un effet de déclencheur qui accorde l'inspiration, et les effets d'un repos appliqués

**Date :** 2026-10-09
**Statut :** acceptée (V3.1-5)

## Contexte

« Ingénieux » (trait humain, SRD 2024) : « Vous gagnez l'Inspiration héroïque lorsque vous terminez un Repos long. » ADR 0036 §7 a décidé que `takeShortRest` / `takeLongRest` émettent `short_rest` / `long_rest`. Il manque un effet qui accorde l'inspiration au vocabulaire fermé des déclencheurs, et hors du tour solo, le moteur rend ses effets sans les appliquer (`triggerRuntime.ts`) : un repos n'en tirerait rien.

## Options envisagées

- **A.** Un effet générique `restore_resource { key }`, avec une clé réservée « inspiration ». L'inspiration n'est pas une ressource du bloc `resources` : une clé réservée mélangerait les deux.
- **B.** Un effet dédié `grant_inspiration { who }`. Il accorde une inspiration, dans la limite du maximum.
- **C.** Du code propre à « Ingénieux » dans `takeLongRest`. C'est exclu par ADR 0036 §7.

## Décision

B. `grant_inspiration { who }` rejoint `EffectNode` et `ResolvedEffect`.

Un repos applique lui-même les effets de son événement, sur l'état d'après repos et en une seule écriture : `applyRestEffects` (`src/core/rules/restEffects.ts`), pur et testé. Il applique quatre effets à l'acteur `self` : `grant_inspiration`, `heal`, `apply_condition` et `remove_condition`. Tout autre effet est rendu « ignoré », avec sa raison, et consigné dans la note du changement, jamais en silence.

Le maximum d'inspiration vaut 1, la règle 2024, jusqu'au réglage de table `inspiration_max` (ADR 0036 §5, V3.1-108). Le tour solo, qui n'a pas d'inspiration dans son état, rapporte l'effet comme ignoré.

## Conséquences

« Ingénieux » est une donnée : un déclencheur `long_rest` dans `data/srd/triggers-2024.json`, qui n'entre en base qu'au prochain `ingest-srd`. Un don ou trait maison peut porter le même effet.
