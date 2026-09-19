# 0027 — Les conditions de déclencheur ont leur propre type, hors de l'AST numérique

**Date :** 2026-09-19
**Statut :** acceptée

## Contexte

`specs/moteur-de-jeu.md` §4 dit : *« Aucune grammaire nouvelle. Le `if` est un nœud d'AST, étendu de quelques opérations booléennes : `and`, `or`, `not`, `eq`, `gte`, `lte`, `has_condition`, `has_feature`, `in_range`. »*

En allant l'implémenter (V3-A1), un fait s'est imposé : `FormulaNode` (`src/core/formula/ast.ts`) est **strictement numérique**. Ses douze opérations sont `num`, `dice`, `ref`, `add`, `sub`, `mul`, `div`, `min`, `max`, `floor`, `ceil`, `round`. Il n'a ni booléen ni comparaison, et `evaluate()` renvoie toujours un `number`, avec une trace de nombres.

Prendre la spec au pied de la lettre ne consiste donc pas à « étendre » l'AST : il faudrait lui donner un second type de retour.

## Options

1. **Étendre `FormulaNode`** des neuf opérations booléennes, et faire renvoyer `number | boolean` à `evaluate()`. Touche l'évaluateur, le formateur (`format.ts`), le parseur et le lexeur — quatre modules éprouvés, couverts de tests, utilisés par les formules de règles, les blocs `resources` et les fiches dérivées.
2. **Un type `ConditionNode` séparé**, dont les feuilles numériques restent de vrais `FormulaNode` évalués par `evaluate()` sans la moindre modification.

## Décision

**L'option 2.** `ConditionNode` vit dans `src/core/rules/triggers.ts`, à côté du reste du mécanisme de déclencheurs.

La promesse de la spec est tenue là où elle compte : **du côté des nombres, il n'y a bien aucune grammaire nouvelle.** `{ "op": "gte", "args": [{ "op": "ref", "name": "event.damage" }, { "op": "num", "value": 1 }] }` compare deux formules ordinaires, avec le même `ref`, le même `evaluate`, les mêmes bornes. Ce qui est nouveau, c'est la couche booléenne qui les enveloppe — et elle n'a aucune raison de vivre dans un évaluateur de formules.

L'argument décisif est le rapport bénéfice/risque : l'option 1 modifie le contrat de retour d'une fonction appelée partout dans le moteur de fiche, pour le seul gain d'un type commun que personne n'a demandé.

## Conséquences

- `evaluate()`, `format.ts`, le parseur et le lexeur sont **inchangés**. Zéro régression possible sur les formules existantes.
- Une condition ne se saisit pas en texte : il n'y a pas de parseur de conditions, seulement des données. C'est cohérent avec V3-A5, qui prévoit un **formulaire** engendré par les schémas Zod, jamais une zone de texte libre.
- Si un besoin réel apparaît un jour d'écrire une condition en notation textuelle, il faudra un parseur dédié — et ce sera un autre ADR, pris sur un cas concret.
- La spec §4 n'est pas réécrite : elle exprime une intention (« pas de seconde grammaire à apprendre »), que cette décision respecte. Le code fait foi sur la forme.
