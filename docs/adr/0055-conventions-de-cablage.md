# 0055 — Conventions de câblage : une donnée, un chargement, au bon moment

**Date :** 2026-10-11
**Statut :** acceptée (V3.1-62, étape 2)

## Contexte

Mesuré le 11 octobre sur le Banc d'essai (`docs/CABLAGE.md` §3) : la fiche de personnage coûte **581 requêtes à la base en 123 vagues**, et se stabilise en environ 23 s en développement. 44 chargements partent après l'affichage. Le ruleset résolu y est demandé 6 fois, les puces de référence 26 fois (une requête par bloc). Chaque appel `/api` repaie la vérification de session, la lecture du monde et la remontée de la chaîne de rulesets. L'accueil du MJ enchaîne 28 vagues. Le temps d'un écran suit le nombre de vagues, plus que le nombre de requêtes (constat de V2.1-20).

## Options envisagées

- **A.** Un cache client générique (SWR, React Query) devant tous les `fetch` : nouvelle dépendance, et il masque les chargements au lieu de les supprimer.
- **B.** Des règles de câblage, écrites dans `docs/CABLAGE.md`, appliquées écran par écran et tenues par un test « cliquet ».

## Décision

B. Sept règles (C1 à C7, détail et exemples dans `docs/CABLAGE.md` §4) :
- C1 : les données initiales arrivent avec la page.
- C2 : une donnée partagée se charge une fois par écran.
- C3 : les lectures indépendantes partent ensemble.
- C4 : pas de requête par ligne.
- C5 : un changement met à jour son coin d'écran.
- C6 : chaque zone a son propre chargement en cours.
- C7 : la sécurité ne s'échange pas contre de la vitesse.

Elles deviennent la règle commune 6 des tickets d'écran du lot i. Le test `lib/cablage.test.ts` échoue si le nombre de chargements après affichage, de `router.refresh()` ou de `window.location.reload()` augmente ; chaque correction abaisse son plafond.

## Conséquences

Le recâblage (V3.1-62, étape 3) suit l'ordre des gains mesurés : la fiche de personnage d'abord. Les mesures « après » reprennent le même protocole (`scripts/mesure-cablage.mjs`). La double vérification de session (middleware et route) reste en place : y toucher demande une décision écrite de l'auteur.
