# 0007 — Forme du moteur de fiche dérivée (Modifier, ResolvedRuleset, DerivedSheet)

**Date :** 2026-08-04
**Statut :** acceptée

## Contexte

V1-B1 demande une fonction pure `characterSheet(build, ruleset, equipment, activeEffects): DerivedSheet` (specs/wiki-liens-et-personnages.md §B7). Le contrat y est esquissé en TypeScript dans la prose, mais rien de tout cela n'existait en code : ni `Modifier`, ni `ResolvedRuleset`, ni `CharacterBuild`. Deux détails du contrat esquissé posaient un problème concret à l'implémentation.

## Options envisagées

- **A. Réutiliser `zModifier`/`zChoice` de `src/core/schemas/rule-blocks/primitives.ts`.** Ils existent déjà, mais `zModifier` n'a pas de champ `source` (indispensable à la provenance §B4) et son `op` se limite à `add|sub|set|mul` (le §B4 en demande huit, dont `advantage`/`disadvantage`/`proficiency`/`expertise`) ; `zChoice.from` est un tableau de chaînes alors que le §B2 demande un objet discriminé (`list` vs `query`). Aucun bloc ne les consomme aujourd'hui — les élargir aurait été un remaniement de schéma Zod sans utilisateur actuel, hors du périmètre du ticket.
- **B. Définir des types TypeScript neufs, propres à `sheet.ts`, fidèles au §B4/§B7.** Duplique du vocabulaire (deux définitions de « modificateur » dans le code), mais reste strictement dans le fichier que le ticket désigne et ne touche à rien d'utilisé ailleurs.
- **A. (rollState) Respecter le contrat §B7 au mot près.** Alors aucun champ ne permet d'observer l'annulation avantage/désavantage de la couche 7 — un critère d'acceptation explicite du ticket devient littéralement impossible à tester.
- **B. (rollState) Ajouter `rollState: "advantage"|"disadvantage"|"normal"` sur `savingThrows`/`skills`.** Extension minimale et directement motivée par un critère du ticket, pas une fonctionnalité non demandée.

## Décision

Nouveaux types dans `src/core/rules/sheet.ts` (option B du premier point), sans toucher `primitives.ts`. Contrat §B7 étendu avec `rollState` (option B du second point).

## Conséquences

- `zModifier`/`zChoice` restent en l'état, non consommés, jusqu'à ce que V1-B2 (bloc `character`) ait besoin d'une forme réelle — à réconcilier à ce moment-là plutôt que d'anticiper.
- Toute couche future (bloc `character`, service d'assemblage de `ResolvedRuleset`, parcours de création V1-B4) doit produire des `Modifier` au sens de `sheet.ts`, pas au sens de `primitives.ts` — un point de vigilance explicite pour qui écrira ces tickets.
- `DerivedSheet` n'est plus au mot près identique au sketch de la spec ; toute lecture future de §B7 doit se référer à `sheet.ts` comme source de vérité pour l'implémentation, la spec restant la source de vérité sur l'intention.
