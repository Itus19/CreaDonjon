# ADR 0035 — Un seul outil de dés, par lequel passent tous les jets

**Date** : 4 octobre 2026 · **Statut** : accepté, à appliquer (V3.1-19, V3.1-21)

## Contexte

Les jets partent aujourd'hui de plusieurs endroits : le panneau de dés (`DiceRollPanel`), les boutons de la fiche, l'initiative, la barre d'intention du solo. Chacun lance à sa façon, et aucun ne sait viser une cible en partie à plusieurs. L'auteur veut pouvoir ajuster un jet (avantage, modificateur, secret) et cibler un participant de l'initiative avant de lancer.

## Options

1. Garder des boutons qui lancent directement, et ajouter une feuille de ciblage à part.
2. Faire passer tous les jets par un seul outil de dés, que chaque bouton pré-remplit.

## Décision

Option 2. Un bouton de jet (attaque, dégâts, sort, soin, caractéristique, sauvegarde, compétence, initiative) **ouvre l'outil de dés pré-rempli** ; on confirme par « Lancer ». L'outil porte, sur une même ligne, **Cibler · Lancer · Effacer** ; Cibler liste les participants de l'initiative (les alliés pour un soin) et se grise hors initiative. Avantage et désavantage tirent les deux d20 ensemble, seul le retenu compte. Animation unique : scintillement. Le même outil sert sur téléphone (feuille du bas), sur ordinateur et tablette (panneau ancré au dé du rail), et en solo (pré-rempli par la barre d'intention).

## Conséquences

- Un toucher de plus par jet, compensé par le pré-remplissage.
- Les dés restent lancés par le serveur et la résolution passe par le moteur (règle absolue 8) : l'outil n'affiche qu'un résultat reçu.
- Une touche réussie propose les dégâts, même cible conservée (dés doublés au critique).
- La résolution automatique (touche contre CA, sauvegardes, dégâts, états) est le ticket V3.1-21 ; le salon où arrivent les jets, V3.1-22.

## Complété le 4 octobre (lot i)

Le gabarit est fixé et identique partout ; seul le pré-remplissage change, son nom en titre (« Jet libre » depuis le dé). En-tête : Secret. Sous la grille : DD, et « DD privé » pour le MJ. Une zone de résultat permanente, à hauteur fixe (« — » et un carré vide par dé avant le lancer). Verdict seulement contre une CA ou un DD, en remplissage de la case (vert, rouge, or au critique). Une bande au pied de la zone devient « Lancer les dégâts » sur une réussite suivie de dégâts, et rien sinon ; les dégâts s'appliquent à la cible. Un monstre qui touche un joueur attend la validation du MJ. Détail et critères : V3.1-33.
