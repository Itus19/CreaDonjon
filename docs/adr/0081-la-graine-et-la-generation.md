# 0081 — La graine, et une génération qui tourne dans le navigateur

**Date :** 2026-10-22
**Statut :** proposée (V4-G1)

## Contexte

Un monde solo naît avec une histoire de plusieurs siècles, régénérable depuis une graine. Ce calcul ne tient pas dans une fonction du plan gratuit de Vercel.

## Options envisagées

- **A.** Le serveur, par tranches — l'état intermédiaire doit être stocké entre deux appels, lourd.
- **B.** Un script local — exclut l'usage hébergé.
- **C.** Le navigateur, dans un *Web Worker*, résultat envoyé par morceaux validés.

## Décision

**C.** Le noyau n'a aucune dépendance : il tourne tel quel dans le navigateur. Morceaux de dix années, validés par Zod, idempotents, écrits sous la RLS ordinaire. Une graine = graine, paramètres, `GENERATOR_VERSION`, empreinte des tables ; changer l'une change le monde, et l'écran le dit. Identifiants déterministes par `hash128`. Détail : `specs/simulation-monde.md` §13.

## Conséquences

- La génération fonctionne aussi en cible locale.
- Les données viennent du navigateur du propriétaire : c'est son monde, la validation Zod suffit.
- `docs/QUOTAS.md` reçoit le volume par âge de monde.
