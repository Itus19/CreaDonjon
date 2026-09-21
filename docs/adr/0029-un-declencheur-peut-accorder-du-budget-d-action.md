# 0029 — Un déclencheur peut accorder du budget d'action

**Date :** 2026-09-21
**Statut :** acceptée

## Contexte

`specs/moteur-de-jeu.md` se contredit, et l'implémentation de V3-A3 l'a rendu visible.

Le **§5** dit : *« Un déclencheur peut en accorder (Fougue du guerrier) ou en retirer. »* C'est aussi un critère d'acceptation du ticket V3-A3.

Le **§4** ferme le vocabulaire d'effets à dix entrées — `saving_throw`, `apply_modifier`, `apply_condition`, `remove_condition`, `deal_damage`, `heal`, `spend_resource`, `move`, `roll`, `narrate_hint` — et **aucune ne touche au budget d'action**. La règle du projet est qu'ajouter au vocabulaire est une décision consignée en ADR ; celui-ci est cette décision.

Sans elle, le critère de A3 serait inatteignable : la Fougue du guerrier resterait du texte.

## Options

1. **Détourner `spend_resource`.** Le budget d'action n'est pas un tracker de ressource : il se remet à zéro à chaque tour, il n'a pas d'identifiant de bloc `resources`, et il accepte des valeurs négatives. Le faire passer par là obligerait `spend_resource` à distinguer deux mondes à l'exécution — précisément le genre de surcharge qui rend un vocabulaire fermé illisible.
2. **Un effet dédié `grant_budget`.**

## Décision

**L'option 2.** Onzième effet : `{ action: "grant_budget", who, kind, amount }`, où `kind` est une des cinq catégories (`action`, `bonus`, `reaction`, `movement`, `free`) et où **un montant négatif retire** — « accorder ou retirer », un seul effet, pas deux.

Le nom dit `grant` parce que c'est l'usage dominant : accorder une action bonus, rendre une réaction. Retirer est le cas rare (une condition qui prive de réaction), et il ne méritait pas son propre verbe.

`amount` est un `FormulaNode`, comme partout ailleurs dans les effets : un déclencheur peut donc accorder un déplacement calculé, pas seulement une constante.

## Conséquences

- Le vocabulaire d'effets compte **onze** entrées. Le test « ni plus ni moins » le verrouille, comme pour les vingt événements (ADR 0028).
- **La spec §4 est en retard sur §5.** Le code fait foi, et ce n'est pas la spec qu'on réécrit : ce fichier note l'écart pour que la prochaine lecture ne conclue pas à un oubli d'implémentation.
- L'application de l'effet n'est pas dans A3. `runTriggers` le **résout** — il produit un `ResolvedEffect` avec son montant calculé — mais rien ne l'applique encore à un budget réel : cela suppose que quelqu'un tienne le budget du tour, ce qui est la boucle de tour, donc le lot B. Même arbitrage que pour tous les autres effets depuis A2 : le moteur propose, il ne mute pas.
- Le budget lui-même vit dans `src/core/rules/actionBudget.ts`, pur, et n'est pas encore persisté. Il le sera avec la scène, quand le lot B fera exister un tour.
