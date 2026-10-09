# ADR 0039 — Nom public « Antre Nous », nom technique CreaDonjon

**Date** : 9 octobre 2026 · **Statut** : accepté par l'auteur le 9 octobre 2026 (écrans d'entrée, V3.1-19)

## Contexte

L'auteur veut un nom public et un logo pour l'application, avec un jeu de mots sur le jeu de rôle. Douze noms et douze logos ont été proposés (planche « Nom public et logo », retirée après le choix). Le dépôt, le code et la documentation s'appellent CreaDonjon.

## Options

1. Renommer partout (dépôt, paquets, documents) : coûteux, et le nom public peut encore changer.
2. Un nom public affiché, distinct du nom technique, réglable sans déploiement.

## Décision

- **Nom public : « Antre Nous »** (l'antre du dragon, et « entre nous », la table d'amis) ; phrase d'accueil « Le repaire de ta table. » ; logo **d20** au trait, en tuile d'accent.
- **CreaDonjon reste le nom technique** : dépôt, code, documentation, ADR. On ne renomme rien.
- Le nom, la phrase et le logo sont des **réglages du superadmin** (Administration › Identité de l'application) ; les valeurs ci-dessus sont les valeurs par défaut, gardées dans `messages/`. Le stockage est tranché par V3.1-84.

## Conséquences

L'interface ne doit jamais écrire « CreaDonjon » en dur : elle lit l'identité de l'application (écran-titre, tête du rail de l'accueil, titre de l'onglet, favicon — V3.1-85, 86). Un logo téléversé est une image PNG ou WebP, jamais un SVG.
