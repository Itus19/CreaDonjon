# 0073 — Identité et orientations : une étiquette pour l'écran, un ensemble pour le moteur

**Date :** 2026-10-22
**Statut :** proposée (V4-B4) · **amendée par** ADR 0086 (la règle « un filtre, jamais un trait » devient « l'identité ne change jamais la personne ; elle change ce que les autres perçoivent, ce qu'ils en pensent, et les risques qu'elle court ») et ADR 0088 (orientations relationnelles ajoutées)

## Contexte

L'auteur veut l'identité de genre, les orientations sexuelle, romantique et relationnelle, toujours affichées. Le moteur doit savoir qui peut attirer qui, y compris pour une étiquette personnalisée ou une personne non binaire.

## Options envisagées

- **A.** Déduire l'attirance de l'étiquette — impossible pour une étiquette libre, ambigu pour « hétéro » face à une personne non binaire.
- **B.** Une étiquette affichée **et** un ensemble d'attirance (`women`, `men`, `non_binary`) proposé depuis l'étiquette, réglable à la main.

## Décision

**B.** Champs facultatifs dans le bloc `character`, chacun avec sa visibilité, **toujours affichés** selon elle. Pronoms structurés avec un accord (m, f, n, mixte) pour la narration française. Un filtre, jamais un trait : une seule exception écrite (besoin `romance` à 0 pour une personne aromantique). Les réglages de table ne touchent qu'au récit (`intimate_narration`) et à la simulation romantique (`romance_simulation`). Aucune attirance ni récit intime ne concerne jamais une personne mineure. Détail : `specs/psyche-v4.md` §9, `specs/simulation-monde.md` §8.5.

## Conséquences

- Un test vérifie qu'aucune de ces données ne modifie facettes, valeurs, besoins ou actions hors des cas écrits.
