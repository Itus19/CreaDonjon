# 0083 — Les besoins du corps passent par les déclencheurs

**Date :** 2026-10-22
**Statut :** proposée (V4-H3)

## Contexte

Faim, soif et fatigue doivent avoir des conséquences de règles (l'épuisement de D&D 2024), sans pénalité improvisée et sans écrire les règles du livre dans le code.

## Options envisagées

- **A.** Coder l'épuisement dans le moteur de simulation — fige une édition de règles.
- **B.** Un événement nouveau des déclencheurs, `need_threshold_crossed`, que les règles du ruleset écoutent.

## Décision

**B.** Ajout au vocabulaire fermé des déclencheurs (`TRIGGER_EVENTS`), avec `event.need` et `event.band`. Les règles de conséquence sont des déclencheurs du ruleset, saisis comme les autres (V3-A5). `body_consequences: "auto"` les applique ; `"gm"` les propose au MJ. Couche « MJ seul » : la conséquence s'applique et se voit comme une condition ; seule la jauge reste cachée.

## Conséquences

- Un ruleset sans ces déclencheurs n'a pas de conséquence : c'est voulu, la règle appartient au ruleset.
