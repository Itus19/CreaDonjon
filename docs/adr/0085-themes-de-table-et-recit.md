# 0085 — Les thèmes de table, et le détail du récit

**Date :** 2026-10-24
**Statut :** proposée (V4-H1, V4-E11)

## Contexte

L'auteur veut pouvoir jouer des univers sombres, horrifiques ou lovecraftiens, et que des thèmes durs (violences sexuelles, traite, torture) existent dans un monde quand la table le choisit, y compris générés par la simulation en solo. Il faut que chaque table puisse aussi les exclure, et que certains ne soient jamais montrés.

## Options envisagées

- **A.** Tout interdire — un monde sans ombre, et des méchants sans passé.
- **B.** Tout permettre selon un seul curseur — on ne peut pas vouloir la torture sans les violences sexuelles.
- **C.** Les outils de sécurité du jeu de rôle (lignes et voiles), thème par thème, plus un réglage séparé pour la violence ordinaire.

## Décision

**C.** Quatre thèmes (violences sexuelles, traite et esclavage, torture, violence envers les enfants), chacun `absent`, `veiled` (saisi par le MJ, raconté par ses conséquences), `veiled_generated` (la simulation peut aussi le produire) ou `shown` (raconté selon le détail de la violence). **Violences sexuelles et violence envers les enfants plafonnent à `veiled_generated`** : jamais racontées. La violence ordinaire n'est pas un thème : `violence_detail` (sobre, descriptif, cru) et `tone` (dont `horror` et `cosmic_horror`). Garde-fous absolus : jamais de contenu sexuel impliquant un mineur ; jamais un PJ victime d'un acte généré (seul le MJ l'enregistre, si `pcs_concerned` l'accepte) ; le modèle peut proposer le **passé** d'un méchant, jamais décider d'un tel acte en partie. Détail : `specs/simulation-monde.md` §11.3, §15.

## Conséquences

- Les actes de ces thèmes ne sont choisis que par des figures dont la psyché le rend possible, et retirés par une éthique `unthinkable`, comme toute action.
- Un fournisseur distant peut refuser un récit cru ; l'écran le dit, le tour continue.
