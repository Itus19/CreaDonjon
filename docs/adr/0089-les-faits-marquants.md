# 0089 — Les faits marquants, et les réactions des PNJ en scène

**Date :** 2026-10-30
**Statut :** proposée (V4-A9 à A12, C11, C12, E12)

## Contexte

L'essentiel du jeu de rôle n'est pas mécanique : insulter, mentir, consoler, séduire, trahir. Sans trace au journal du monde, personne ne s'en souvient. Et en scène, les PNJ étaient joués par le récit du modèle : ce qu'il leur faisait faire n'était ni arbitré, ni retenu (le défaut de sœur Aude, ADR 0009).

## Options envisagées

- **A.** Saisie à la main seulement — trop lourd en jeu.
- **B.** Le modèle qualifie seul ce que fait le joueur, et fait réagir les PNJ — rapide, mais il décide (règle 8).
- **C.** Une puce d'acte fermée, pré-remplie par le modèle et confirmée par le joueur ; des réactions de PNJ choisies par le moteur ; des témoins tranchés par les règles.

## Décision

**C.** Quatre sources de faits : la mécanique (traduite), l'acte déclaré (la puce d'acte, avec son jet s'il est incertain), les PNJ en scène (réaction choisie par utilité dans un vocabulaire de scène ; en campagne, **suggérée** au MJ qui décide), et la table physique (saisie rapide ; journal de séance dont le modèle propose des faits cochés par le MJ). Les témoins d'un acte discret : le jet du PJ contre la Perception passive de chaque présent. Un acte sans témoin peut être découvert plus tard (constat de la victime, croyance à coupable inconnu, déduction). Le modèle **propose** des étiquettes ; il ne décide ni d'un fait, ni d'une réaction. Détail : `specs/simulation-monde.md` §5.4 à §5.8, §10.7. Esquisse : artefact « Faits marquants — esquisse » (28 octobre).

## Conséquences

- Le récit du modèle ne fait plus agir les PNJ en solo : il raconte ce que le moteur a choisi.
- Trois genres d'événements s'ajoutent : `threatened`, `blackmail`, `loss_noticed`.
- La spec du moteur remplace « aucune action en classe `scene` » par le vocabulaire de scène.
