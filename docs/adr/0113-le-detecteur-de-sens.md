# 0113 — Faut-il un jet ? L'IA classe la phrase dans une liste fermée, le moteur fixe le DD

**Date :** 2026-11-26
**Statut :** acceptée le 26 novembre 2026 (choix de l'auteur dans le fil « Intégrer le lancer de dés au récit solo », options A aux trois questions) ; livrée par V3.2-22 à 24

## Contexte

Séance du 25 novembre : le moteur demande un jet d'Histoire parce que la phrase contient le mot « histoire » ; un jet de Persuasion part sans DD, et c'est le récit qui devine l'issue. Le lexique de `interpretIntent` voit des mots, pas un sens. Il ne sait ni fixer une difficulté, ni dire « pas besoin de jet » quand l'action est évidente pour ce personnage (ADR 0104 §4). V3.2-21 a resserré le lexique (plus de jet sur un nom de compétence isolé), sans régler le fond.

Le DD est un résultat de règle (règle absolue 8) : un modèle ne doit jamais l'écrire.

## Options

- **A — Le lexique seul**, enrichi. Sûr et gratuit, mais aveugle au sens et incapable de fixer un DD.
- **B — L'IA décide du jet et donne le DD.** Refusé : un nombre inventé par le modèle.
- **C — L'IA classe dans une liste fermée, le moteur chiffre.** Retenu.

## Décision

1. **À chaque tour libre** (option A de l'auteur), avant de jouer, le serveur demande au modèle un classement validé par Zod : `none` (rien à tester), `trivial` (évident pour ce personnage), ou `check` avec une action prise dans la liste des actions de la fiche (compétence, caractéristique, sauvegarde) et un palier : `tres_facile`, `facile`, `moyen`, `difficile`, `tres_difficile`, `quasi_impossible`.
2. Le moteur traduit le palier en DD selon D&D 2024 : 5, 10, 15, 20, 25, 30 (`src/core/rules`, pur).
3. **Réussite automatique** (option A) si le modèle dit `trivial`, ou si le pire jet réussit quand même (1 + modificateur ≥ DD), calculé par le moteur.
4. **La proposition passe avant le dé** (option A) : la pastille offre « Lancer », « Sans jet » et « Changer » (autre action de la fiche). Le DD reste caché, sauf réglage `solo_show_outcome`.
5. Le narrateur reçoit le fait complet du jet, DD et verdict compris : il raconte l'issue, il ne la juge plus.
6. Contexte du classement : la phrase et les extraits du wiki encadrés comme données (règle 10), bornés à ce que le personnage sait (règle 11). Journal `ai_usage_log`, usage `solo_classify`, à chaque appel, échec compris (règle 13). `purpose` est un `text` : aucune migration.
7. **Repli** : sans modèle joignable, ou si la réponse échoue à Zod, le lexique V3.2-21 décide, comme aujourd'hui. Le jeu ne bloque jamais sur l'IA.

## Conséquences

- Un appel court de plus par tour libre, 2 à 5 secondes avec le fournisseur local, avant la pastille ou le récit. Aucune requête de base supplémentaire.
- Un corpus d'évaluation hors ligne (40 à 60 phrases françaises et leur classement attendu) mesure le modèle local avant le branchement.
- Le DD vient désormais du moteur ; le champ DD facultatif de l'outil de dés reste pour le jet manuel.
- Le lexique ne disparaît pas : il reste le filet quand l'IA manque.
