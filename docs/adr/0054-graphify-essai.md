# 0054 — Graphify : essayé, gardé comme outil d'audit ponctuel, pas en continu

**Date :** 2026-10-10
**Statut :** acceptée (essai demandé par l'auteur)

## Contexte

Graphify (`graphifyy` 0.9.84, licence Apache-2.0) construit un graphe du code, sans IA (tree-sitter), que Claude Code peut interroger au lieu de relire les fichiers. Ses auteurs annoncent des gains de 70× en jetons. Essai fait sur une copie du dépôt, rien n'a été installé dans le projet.

## Mesures (10 octobre)

- **Construction** : 20 s ; 8 035 nœuds, 23 549 liens, 310 communautés. Les migrations SQL sont ignorées sans l'extra `[sql]`. 217 Mo de dépendances Python.
- **`GRAPH_REPORT.md`**, que son skill fait lire en début de session : environ **24 000 jetons**.
- **`graphify explain <fonction>`** : 300 à 700 jetons, contre 80 à 250 pour une recherche `grep`. En échange, il donne d'un coup les appelants, les fonctions appelées et les tickets ou ADR qui en parlent.

## Décision

**Pas d'adoption en continu**, ni hook ni skill installé. Les sessions de CreaDonjon ciblent déjà un fichier en une ou deux recherches. Le rapport coûte plus cher à lire que ce qu'il économise, et il faudrait le régénérer à chaque série de changements.

**Gardé comme outil d'audit ponctuel**, avant un grand chantier : une carte des dépendances et des **cycles d'import**. Le premier passage en a trouvé six dans `src/server/services/` (campaigns, entities, worlds, worldPlayerCharacters, sessionJournal, rules, resolvedRuleset) et deux dans `components/blocks/` (LevelUpWizard, PlayableCharacterSheet).

L'économie de jetons vient d'ailleurs : le backlog découpé en un index et un fichier par partie (`docs/backlog-v3.1/`, même jour).

## Conséquences

Pour un audit : `uv tool install graphifyy`, puis `graphify update .` hors du dépôt ou avec `graphify-out/` ignoré par Git. Ses sorties ne se commitent pas.
