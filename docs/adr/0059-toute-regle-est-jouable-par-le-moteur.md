# 0059 — Toute règle est jouable par le moteur

**Date :** 2026-10-13
**Statut :** acceptée (étude `docs/etude-regles-jouables.md`)

## Contexte

L'étude de 39 règles (SRD 2024 et maison) montre qu'avec le vocabulaire actuel aucune n'est entièrement jouable, et qu'une partie resterait « en texte » même après les trois pièces proposées (activation, ressources déclarées, effets qui durent). En solo, une règle en texte n'est arbitrée par personne : ignorée en silence, ou tranchée par le modèle, ce qu'interdit la règle absolue n° 8. `specs/moteur-de-jeu.md` §3 et §10 prévoyaient de rouvrir la question d'une échappatoire à la troisième règle inexprimable ; l'étude en trouve plus de trois.

## Options envisagées

- **Échappatoire.** A : toujours une brique de données de plus — tout reste modifiable par l'auteur, le vocabulaire grossit. B : un comportement codé et testé, rattaché à la clé d'une règle — rapide pour un cas isolé, mais une règle maison qui en dépend n'est plus modifiable sans code. C : laisser le modèle lire la règle — exclu par la règle n° 8.
- **Distances.** A : les trois zones abstraites (§6), chaque distance approximée par une zone. B : des distances réelles entre créatures, sans grille.

## Décision

1. **Toute règle d'un ruleset en jeu est jouable à 100 % par le moteur.** Toute conséquence mécanique (jets, cibles permises ou refusées, états, durées, ressources, dégâts, perception) est résolue par le code ; le modèle reçoit le résultat et le raconte.
2. **Une règle ouverte** (« le MJ décide », Souhait, examiner une illusion) se résout par un **choix contraint** décrit en données — options proposées au joueur, ou table — jamais par le modèle.
3. **La couverture se voit.** Chaque fiche porte son état (jouable, ou ce qui manque) ; le mode solo avertit avant qu'une règle incomplète n'entre en jeu.
4. **Échappatoire : A.** Une mécanique nouvelle devient une brique de données, même pour un seul cas. La règle des trois ne décide plus *si* une mécanique est prise en charge, seulement *quand* on la généralise.
5. **Distances : B.** Le moteur tient des distances réelles en mètres entre les créatures d'une scène, sans plateau ni grille tactique. Les trois zones (`engaged`, `near`, `far`) deviennent une lecture de ces distances, pour l'affichage et la narration.

## Conséquences

- L'objectif tenable est **100 % des règles présentes dans nos rulesets**, pas de toute règle imaginable : une règle maison nouvelle qui ne s'exprime pas encore est signalée, puis une brique est ajoutée (un ticket).
- Six chantiers (étude, « Ce qui ressort ») : fondation (activation, ressources déclarées, effets qui durent), valeurs calculées, intervenir sur un jet, actions modifiées, conditions de jeu, **modèle du monde** (perception, lumière, étiquettes de magie, immunités de ciblage). La forme des données de la fondation fait l'objet d'un ADR suivant.
- `in_range` change de nature (une distance, plus une zone) : `specs/moteur-de-jeu.md` §6 et §10 sont amendés par cet ADR. Les déclencheurs existants qui testent une zone restent valides, la zone étant dérivée de la distance.
- Le vocabulaire fermé grossira, et chaque ajout reste une décision consignée — mais il n'y a plus de refus « par principe ».
- Prouver la couverture demande l'inventaire de tout ce qui entre en jeu, monstres compris, pas seulement l'échantillon.
