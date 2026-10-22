# 0068 — Le hasard dérivé

**Date :** 2026-10-22
**Statut :** proposée (V4-A2)

## Contexte

Avec un flux aléatoire unique consommé dans l'ordre, un seul tirage de plus quelque part décale tous les suivants : un joueur qui parle à un PNJ changerait l'histoire du royaume voisin. Ce n'est pas un effet papillon, c'est du bruit.

## Options envisagées

- **A.** Un flux global — simple, mais chaotique.
- **B.** Un flux par figure — mieux, mais un tirage de plus pour une figure décale encore tous ses autres motifs.
- **C.** Un tirage dérivé de (graine, frontière de temps, figure, motif).

## Décision

**C.** `deriveRng(seed, ...keys)` dans `src/core/sim/random.ts` : hachage MurmurHash3 (finaliseur `fmix32`) des clés, qui initialise un xorshift32, derrière l'interface `Rng` existante. `hash128` en tire aussi les identifiants déterministes de la génération. Écrit à la main, sans dépendance.

## Conséquences

- Un choix du joueur ne change que ce qui en découle causalement.
- Toute fonction de simulation reçoit ses clés explicitement ; un tirage sans clé est un bogue, qu'un test de déterminisme attrape.
