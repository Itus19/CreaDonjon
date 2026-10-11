# 0056 — Les données de la fiche partent avec la page (promesse en flux)

**Date :** 2026-10-11
**Statut :** acceptée (V3.1-62, règle C1 de `docs/CABLAGE.md`)

## Contexte

La fiche de personnage ne demandait ses données qu'une fois affichée. Le serveur envoyait la page, puis le navigateur chargeait le code de la fiche (chargé à part), qui appelait `/sheet` et `/resolved-ruleset` vers 1,7 s. Ces appels attendaient encore la session et le monde avant de calculer : tout était prêt vers 5,4 s. Le ruleset se calculait deux fois, une fois par route.

## Options envisagées

- **A. Données attendues par la page** : le serveur calcule la fiche avant d'envoyer la page. Simple, mais la page reste blanche environ 3,5 s de plus.
- **B. Promesse en flux** : la page lance le calcul sans l'attendre et passe la promesse aux composants. La page s'affiche aussitôt, et les données arrivent dans le même flux dès qu'elles sont prêtes.
- **C. Préchargement côté navigateur** : petit gain, sans supprimer les deux calculs.

## Décision

B, choisie par l'auteur.
- `src/server/services/ficheAvecPage.ts` calcule en une fois ce que rendaient `/sheet` (hors campagne) et `/resolved-ruleset`, avec les mêmes droits : client de l'appelant, état de départ enregistré seulement pour qui peut éditer. `lancerFicheAvecPage` le lance sans l'attendre, pour les trois pages qui affichent une fiche via `EditEntityForm`.
- `useAmorcerFicheAvecPage` (navigateur) adopte cette promesse dans les chargeurs de la fiche (`amorcer`, `lib/chargement/chargeurParLots.ts`). Il le fait pendant le premier rendu du formulaire, donc avant les effets de la fiche, d'où partaient ses appels.
- La clé du ruleset est calculée des deux côtés par la même fonction (`lib/resolvedRuleset/selection.ts`). Si elle diffère, la réponse est ignorée et la fiche demande la sienne, comme avant.

## Conséquences

Trois pièges, notés dans le code :
1. **La promesse reçue n'est pas une vraie promesse.** React la reconstruit en « thenable » dont `then` ne renvoie rien. On la passe donc toujours par `Promise.resolve` avant de l'enchaîner. Sans cela, la fiche attendait sans fin.
2. **L'amorçage ne se fait jamais pendant le rendu serveur.** Les chargeurs sont des modules du navigateur ; sur le serveur, ils seraient partagés entre les requêtes, donc entre les utilisateurs.
3. **Le document se termine plus tard** (`DOMContentLoaded`), puisque les données arrivent dans le même flux. L'affichage et l'interactivité, eux, ne l'attendent pas.

Ce motif sert à tout écran qui charge après l'affichage des données que le serveur pourrait calculer avec la page.
