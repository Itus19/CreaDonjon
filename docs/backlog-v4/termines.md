# Backlog V4 — Tickets terminés (☑)

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md).*

Un ticket qui passe à ☑ est déplacé ici depuis le fichier de son lot, rangé par lot.

## Conception

### ☑ V4-0 — Concevoir la V4 · sans modèle IA — **fait le 22 octobre 2026**

Les anciens tickets « à concevoir » (A1, A3, A4, A6, B1, C1, C4, D1, E1, E4, E6, F3, G1, H3, H5 de la version 1.0 de ce backlog) sont conçus, puis renumérotés en tickets prêts dans leurs lots.

- [x] Recherche : `docs/recherche/simulation-inspirations.md` (DFHack et wiki de Dwarf Fortress, RimWorld, Crusader Kings III, Les Sims, Talk of the Town, Nemesis, Wildermyth, Ultima IV, Caves of Qud, l'IA par utilité, OCC et HEXACO).
- [x] Spec de la psyché : `specs/psyche-v4.md` (ancien V4-B1).
- [x] Spec du moteur : `specs/simulation-monde.md`.
- [x] ADR 0067 à 0084, au statut « proposée » jusqu'à ce que leur ticket soit codé.
- [x] Bandeau de renvoi dans `specs/psyche-pnj.md` ; lignes ajoutées dans `CLAUDE.md`.


### ☑ V4-0b — Compléter la conception · sans modèle IA — **fait le 24 octobre 2026**

Décisions prises avec l'auteur les 22 et 24 octobre.

- [x] « État de départ » pour le bloc d'une entité ; « graine » réservée au nombre qui régénère un monde (ADR 0067 amendé).
- [x] Mémoire longue : curseur de 30 à 365 jours, 90 par défaut, 365 en génération (ADR 0074 amendé).
- [x] Sexualité dans la psyché : attirance, libido et rapport au sexe séparés ; besoins `intimacy` et `tenderness` ; consentement et âge adulte comme règles absolues (ADR 0087).
- [x] Accords et structures d'union : couple libre, libertin·e, polyamour solo, harem (ADR 0088).
- [x] Identité perçue, normes, préjugés, vies cachées ; la règle d'identité reformulée (ADR 0086, amende 0073).
- [x] Thèmes de table et détail du récit (ADR 0085).
- [x] Tickets nouveaux : C9, C10, E11 ; tickets amendés : A4, A6, A7, B1, B4, B5, B6, B9, C1, E4, E7, E9, E10, G2, G3, H1, H2.
- [x] Les faits marquants et la simulation générale : voir V4-0c.

### ☑ V4-0c — Les faits marquants · sans modèle IA — **fait le 30 octobre 2026**

Décisions prises avec l'auteur les 28 et 30 octobre, d'après une esquisse en cinq planches (artefact « Faits marquants — esquisse »).

- [x] Quatre sources de faits : mécanique, acte déclaré (puce d'acte pré-remplie par le modèle et confirmée), PNJ en scène, table physique (ADR 0089).
- [x] Les réactions des PNJ en scène sont choisies par le moteur en solo, suggérées au MJ en campagne.
- [x] Témoins par la Perception passive, indices et découverte après coup, dès la V4.
- [x] Journal de séance lu par le modèle, faits cochés par le MJ.
- [x] Tickets nouveaux : A9, A10, A11, A12, C11, C12, E12 ; tickets amendés : A4, A7, E9.
