# 0116 — La météo se calcule : climat du lieu, saison du calendrier, perçu selon qu'on est dedans ou dehors

**Date :** 2026-11-26
**Statut :** proposée (fil « Rendre la météo dynamique »), en attente de l'auteur.

## Contexte

La météo du solo est tirée une fois à la table MJ `meteo` quand le personnage change de lieu (V3-C6), puis reste figée. Elle ne connaît ni l'heure, ni la saison, ni la géographie, et l'IA la reçoit sans savoir si le personnage est à l'abri : elle fait pleuvoir dans la taverne. L'auteur veut une météo qui dépend du lieu (biome, carte Azgaar) et de la saison.

## Options

- **A — Garder la table MJ et la retirer plus souvent** (chaque heure). Refusé : aucun lien avec le lieu ni la saison, et un temps qui saute d'une heure à l'autre.
- **B — Simuler l'atmosphère en continu** (fronts qui se déplacent sur la carte). Refusé : un tic de fond, des écritures, et rien à gagner tant que personne ne regarde (même raison que l'ADR 0115).
- **C — Calculer la météo à la lecture**, fonction pure du climat du lieu, de la date et de l'heure, à graine fixe. Retenu.

## Décision

1. `weatherAt(climat, date, heure, graine)` dans `src/core/weather/` : normale saisonnière + perturbations lisses de quelques jours + courbe de la journée. Rien n'est stocké que les données du climat.
2. Le climat vient du bloc `settlement` (importé d'Azgaar : température moyenne, humidité, latitude, altitude, côte), sinon des normales du biome, sinon d'un climat par défaut du monde.
3. La saison vient du calendrier : jour de l'année, hémisphère par la latitude, cœur de l'hiver réglable.
4. Le moteur rend ce que le personnage **perçoit** selon l'exposition de sa pièce (`outdoor`, `sheltered`, `indoor`). L'IA reçoit le temps et le perçu, séparés.
5. La table MJ devient un forçage facultatif, avec échéance, qui prime sur le calcul.

## Conséquences

- `SceneState.weather` disparaît (valeur dérivée, règle absolue 16) ; le bloc `settlement` passe en version 2, le bloc `rooms` gagne l'exposition ; aucune migration SQL.
- La météo marche dès ME-5 avec le climat par défaut, avant l'import Azgaar.
- Les effets en jeu (Guide du maître 2024) attendent un ticket à part, comme l'éclairage attend la vision.
- Détail : `specs/meteo.md`.
