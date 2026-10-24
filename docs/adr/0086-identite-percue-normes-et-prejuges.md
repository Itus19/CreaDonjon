# 0086 — Identité perçue, normes et préjugés

**Date :** 2026-10-24
**Statut :** proposée (V4-C9, V4-C10) · **Amende :** ADR 0073 (« un filtre, jamais un trait »)

## Contexte

L'auteur veut que la répression ou l'acceptation des orientations se sente dans un lieu, avec des vies cachées, des lieux sûrs, des mariages de façade ; et que ce qui se voit (une espèce, une apparence) expose aux préjugés d'un personnage raciste. La règle « un filtre, jamais un trait » interdisait tout effet social de l'identité.

## Options envisagées

- **A.** Garder la règle — l'enjeu social disparaît.
- **B.** Faire de l'identité un modificateur direct de la personne — c'est encoder des stéréotypes.
- **C.** L'identité ne change jamais la personne ; elle change ce que les autres perçoivent, ce qu'ils en pensent, et les risques qu'elle court.

## Décision

**C.** Tout effet social passe par trois chemins : les **croyances** des autres (ce qui se voit est perçu à la rencontre, sauf déguisement ; ce qui ne se voit pas s'apprend par la conduite, la confidence, la rumeur ou une fausse accusation), les **normes** (de la culture et des individus, sur des conduites connues : acceptée, tolérée, désapprouvée, réprimée, persécutée), et ce que la personne **choisit de montrer** (caché, discret, ouvert, par contexte ; vivre caché coûte du stress). Les **attitudes envers les groupes** s'héritent de la culture (et de l'histoire générée), se modulent par la tolérance et se nourrissent de l'expérience. Lieux sûrs secrets, unions de façade. Réglages : `identity_norms` (le monde) et `pcs_concerned.identity` (les PJ). Détail : `specs/simulation-monde.md` §8.6, §8.7.

## Conséquences

- On ne discrimine que ce qu'on perçoit ou croit savoir : un déguisement protège, une rumeur expose.
- Le test de la règle d'identité vérifie à la fois l'absence d'effet direct et la présence des seuls chemins permis.
