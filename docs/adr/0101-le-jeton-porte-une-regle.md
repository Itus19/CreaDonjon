# 0101 — Le jeton porte une règle : valeurs figées, réaction d'une règle absente de la fiche, usage décompté

**Date :** 2026-11-17
**Statut :** acceptée (V3.1-163)

## Contexte

Le jeton d'un effet qui dure (ADR 0073, V3.1-197) accorde une activation tant que l'effet dure : Majesté souveraine, l'Injonction de Mante de majesté. Trois limites empêchent de jouer le dé d'Inspiration bardique, que le barde donne à un allié et que l'allié ajoute à un test raté :

1. **L'activation appartient à la règle du barde.** Les fenêtres de réaction ne cherchent leurs candidates que dans les aptitudes de la fiche de celui qui lance le dé, et `activateFeature` refuse une règle absente de la fiche (`feature_not_owned`). L'allié ne se voit rien proposer.
2. **La taille du dé est celle du barde.** Elle dépend de son niveau, pas de celui de l'allié. Une formule évaluée avec les nombres de l'allié se tromperait.
3. **Le jeton n'est jamais décompté.** `consumeToken` existe dans le noyau, mais aucun service ne l'appelle. Un usage unique ne s'épuise donc jamais.

## Décision

1. **Des valeurs figées à la pose.**
   - Le jeton gagne `values`, un dictionnaire facultatif de formules.
   - Elles sont calculées à la pose avec les nombres de la source (comme le DD du JS répété, ADR 0098), puis rangées dans l'instance (`tokenValues`, dans le `payload` JSON, sans migration).
   - Les formules de l'activation accordée les lisent sous `token.<nom>`.
2. **Une activation accordée se joue sans que sa règle soit sur la fiche.**
   - Le porteur doit avoir un effet actif de cette règle (`source_key`) dont le jeton accorde l'activation, avec un usage restant. C'est toujours le serveur qui le vérifie.
   - Ses formules lisent les nombres du porteur, plus les valeurs du jeton.
   - Les fenêtres de réaction lisent les effets de tous les PJ du réservoir **en une requête**, puis les blocs des règles étrangères en une requête groupée, seulement s'il y en a.
3. **Jouer une activation accordée consomme un usage du jeton** (`consumeToken`), par un clic sur la fiche comme par une réaction choisie dans une fenêtre. Le dernier usage retire l'effet.

## Conséquences

- Inspiration bardique se saisit en données :
  - le barde pose un effet sur l'allié, avec un jeton (un usage, `values.die` selon son niveau) ;
  - l'activation accordée est une réaction sur un test d20 raté du porteur, qui ajoute `1d{token.die}`.
- Les jetons de V3.1-197 se décomptent désormais. Un effet à plusieurs usages (Injonction à chaque tour) perd un usage par emploi.
- **Coût (QUOTAS)** : une lecture des effets de plus par réservoir de fenêtre, pour tous les PJ à la fois. Une lecture groupée de blocs, seulement si un jeton étranger existe.
