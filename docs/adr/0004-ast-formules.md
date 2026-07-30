# 0004 — Formules parsées une fois vers un AST, jamais évaluées via eval()

**Date :** 2026-07-28
**Statut :** acceptée

## Contexte

Le moteur de règles doit évaluer des expressions comme `2d6+{STR_MOD}`, potentiellement des milliers de fois par partie, et parfois à partir d'un contenu généré par une IA. `eval()`/`new Function()` seraient triviaux à écrire mais ouvrent un interpréteur généraliste sur une chaîne non fiable — inacceptable (CLAUDE.md, règle absolue 5).

## Options envisagées

- **A.** `eval()` sur une chaîne assainie — rapide à écrire, surface d'attaque incontrôlable, aucune limite de coût imposable.
- **B.** Grammaire fermée (`num`, `dice`, `ref`, `add`/`sub`/`mul`/`div`, `min`/`max`/`floor`/`ceil`/`round`), parsée une seule fois à la saisie vers un AST stocké en jsonb, évaluée via un `Rng` injecté et jamais re-parsée.

## Décision

B. Le texte est parsé une fois ; c'est l'AST qui est stocké et évalué. `evaluate(ast, ctx, rng, mode)` ne connaît que ces onze types de nœuds. Limites dures avant toute évaluation : 1000 dés/nœud, 1 000 000 faces, profondeur 32, 500 nœuds — une référence inconnue lève toujours une erreur typée, jamais un `0` silencieux.

## Conséquences

- `rng` injecté (jamais `Math.random()` interne) rend les tests déterministes et le rejeu possible avec la même graine.
- `mode: 'average'` affiche une valeur moyenne sans consommer le RNG — utile pour une fiche de règle qui ne « joue » pas.
- Un AST généré par une IA buguée ou hostile échoue à la validation Zod/aux limites avant d'atteindre l'évaluation, jamais pendant.
