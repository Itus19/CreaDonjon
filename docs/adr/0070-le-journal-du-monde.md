# 0070 — Le journal du monde, et le pont du jeu vers le monde

**Date :** 2026-10-22
**Statut :** proposée (V4-A4, V4-A7)

## Contexte

Les souvenirs, la chronique et le récit ont besoin d'une trace de ce qui arrive. `session_events` est le journal de la table, pas celui du monde. Et ce que font les PJ doit entrer dans le monde, sinon personne ne s'en souvient.

## Options envisagées

- **A.** Étendre `session_events` — mélange la table et le monde, et la génération n'a pas de séance.
- **B.** Une table `world_events` en ajout seul, au vocabulaire fermé.

## Décision

**B.** `world_events` : 49 genres fermés (vérifiés par Zod, étendus par ADR), acteurs et cibles en tableaux d'identifiants de figures, `cause_id` pour la chaîne causale, `scope` pour la Chronologie, `compensates_id` pour annuler. Les interactions du quotidien ne s'y écrivent pas. Le pont : les `session_events` sont traduits au début de chaque lot par une table pure, et un « fait marquant » se saisit à la main. L'IA ne crée pas d'événement du monde en V4. Détail : `specs/simulation-monde.md` §5.

## Conséquences

- L'intégrité des tableaux d'identifiants est applicative, comme le dit la spec.
- La Chronologie du monde (ADR 0048) gagne une troisième source.
