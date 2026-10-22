# 0082 — Le questionnaire de psyché

**Date :** 2026-10-22
**Statut :** proposée (V4-D1)

## Contexte

Cinquante facettes ne se règlent pas à la main. L'auteur veut un questionnaire pour les joueurs, le MJ et le moteur. `CLAUDE.md` interdit de suivre par Git du contenu de règles.

## Options envisagées

- **A.** Questionnaire en base — il faudrait le saisir pour chaque monde.
- **B.** Questionnaire par défaut suivi par Git — c'est du contenu original de l'application, comme les libellés, pas du contenu de livre.

## Décision

**B.** Structure (questions, réponses, effets bornés, parcours court de 12 et long de 40) dans `src/core/psyche/questionnaire/` ; textes dans `messages/`. Des dilemmes sans bonne réponse, à la manière d'Ultima IV. Chaque réponse pousse 2 à 4 facettes ou valeurs, amorties. Les questionnaires propres à un monde vivront en base (V4-D6). L'identité et les orientations ne se déduisent jamais : elles se choisissent.

## Conséquences

- La règle « le contenu de règles est de la donnée » n'est pas touchée : ce questionnaire n'est tiré d'aucun livre.
