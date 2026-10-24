# 0074 — La mémoire en trois temps

**Date :** 2026-10-22
**Statut :** proposée (V4-C1)

## Contexte

`attitude_events` est une mémoire par paire, sans oubli ni hiérarchie. Dwarf Fortress montre une mémoire qui oublie, consolide et transforme (8 souvenirs courts, 8 longs, des souvenirs fondateurs).

## Options envisagées

- **A.** Tout garder — le contexte du modèle et l'écran débordent, et rien ne distingue l'essentiel.
- **B.** La mémoire de Dwarf Fortress telle quelle — un an avant la mémoire longue : trop lent pour une campagne ; rien de réservé au joueur.
- **C.** Celle de Dwarf Fortress, réglée pour le jeu de rôle, plus 4 emplacements réservés aux souvenirs qui impliquent un PJ.

## Décision

**C.** 8 courts (un par groupe), 8 longs (après un délai réglable de 30 à 365 jours au jour près, 90 par défaut et 365 pendant la génération, ou aussitôt au-dessus de 80), 4 du joueur. Revivre ravive l'émotion ; un souvenir formateur revécu a une chance sur trois de devenir fondateur et déplace des facettes ou des valeurs, avec sa cause affichée. Oublier n'efface rien du journal du monde. Détail : `specs/simulation-monde.md` §7.

## Conséquences

- Les souvenirs vivent dans `sim_figures.state` (bornés, petits), pas dans une table.
- Un PNJ se souvient du joueur des années après, comme dans le système Nemesis.
