# 0053 — Une session Opus qui délègue à Sonnet et à Haiku

**Date :** 2026-10-10
**Statut :** acceptée (demande de l'auteur)

## Contexte

Le backlog indique pour chaque ticket le modèle qui convient (Opus ou Sonnet). L'auteur veut lancer une seule session Opus qui confie elle-même aux autres modèles ce qui leur revient, sans avoir à ouvrir une session par modèle.

## Options envisagées

- **A.** Une session par ticket, avec le modèle choisi à la main. C'est simple, mais tout le tri reste à l'auteur.
- **B.** Une session Opus qui orchestre et délègue à des sous-agents du projet, chacun avec son modèle. Opus relit tout ce qui est délégué.

## Décision

B. Deux sous-agents dans `.claude/agents/` :
- `dev-sonnet` code un ticket « Sonnet » d'après sa spécification ;
- `aide-haiku` fait les gestes mécaniques : vérifications, libellés, planches, recensements.

`CLAUDE.md` (« Répartition par modèle ») autorise Opus à déléguer sans qu'on le demande. Opus garde la conception, la sécurité, la RLS, les migrations et le moteur, relit chaque diff, puis commite.

Haiku ne reçoit pas de ticket entier : même les petits demandent du jugement sur l'interface ou les tests. Chaque ticket prêt porte une ligne « Sous-tâches Haiku ».

## Conséquences

Chaque délégation repart de zéro et coûte une relecture : un ticket de quelques lignes reste à Opus. Les sous-agents ne commitent ni ne poussent. L'accès aux modèles dépend de l'abonnement de l'auteur.

## Complément du 10 octobre

La méthode détaillée vit dans le skill `deleguer` (`.claude/skills/deleguer/SKILL.md`), chargé seulement au moment de déléguer, pour ne pas alourdir `CLAUDE.md` lu à chaque session. Elle reprend le tri par type de tâche, le reclassement unique et la mesure de TokenWise (CodeShuX/tokenwise, MIT, lu, non installé : il réécrit le `CLAUDE.md` global et tient un journal hors du dépôt). Les coûts se notent dans `docs/DELEGATIONS.md`.
