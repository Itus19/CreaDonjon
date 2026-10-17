# ADR 0066 — Les fenêtres du MJ en deux volets à onglets

**Date** : 17 octobre 2026 · **Statut** : acceptée (V3.1-20) · **Remplace** la partie « fenêtres flottantes » de l'ADR 0006 ; l'adressage par fiche (ADR 0006, 0011) ne change pas.

## Contexte

Depuis l'ADR 0006, chaque fiche ouverte sur ordinateur est une fenêtre flottante : déplaçable, aimantée à une moitié d'écran, réductible dans une barre en bas, ouverte à 860 px en cascade. Elle ne se redimensionne pas, et c'est au MJ de ranger. L'auteur veut que la place se répartisse toute seule (V3.1-19, lot g ; quatre propositions esquissées, la troisième retenue le 1ᵉʳ octobre).

## Options

1. Tuiles à deux. 2. Une grande fiche et une pile. 3. **Deux volets à onglets.** 4. Une fiche et des vignettes.

## Décision

La 3, sans fenêtre flottante :

- une fiche prend toute la zone de travail ; une deuxième ouvre un second volet, moitié-moitié ; au-delà, une fiche s'ajoute **en onglet** au volet actif (le dernier cliqué), sans rien remplacer ;
- glisser un onglet sur l'autre volet l'y fait passer ; le glisser sur la moitié vide quand il n'y a qu'un volet crée le second ;
- un volet vidé disparaît ; le séparateur se glisse (20 à 80 %), un double-clic le ramène au milieu ;
- pastilles : agrandir un volet le temps de lire (état local), fermer l'onglet affiché ;
- la barre des fiches réduites (V2-K4) disparaît : les onglets la remplacent ;
- sur téléphone, rien ne change (plein écran, la pile « N fiches » de V3.1-29).

**Adresse.** Les fiches ouvertes restent dans le chemin (la fiche primaire, rendue par le serveur) et `?avec=` (les autres). Un paramètre `?volets=` ajoute leur place : fiches de gauche, fiches de droite, onglets actifs, volet actif, partage. Il est écrit par `history.replaceState`, comme `?avec=` : aucun aller-retour serveur. Une fiche que l'adresse ne cite pas (ancien lien, fiche ouverte par une navigation) est placée par la règle ci-dessus ; une adresse abîmée ne lève jamais d'erreur. La logique est pure et testée : `lib/ui/volets.ts`.

**Rendu.** Une seule couche (montée au-dessus des trois sections, comme les fenêtres `avec` aujourd'hui) dessine les volets, leurs onglets et le séparateur, et réserve à chaque fiche une boîte stable, gardée par son identifiant. La fiche primaire, rendue par sa section, y entre par un portail React : changer une fiche de volet déplace sa boîte, jamais son contenu, qui n'est pas remonté (un brouillon survit).

## Conséquences

- Plus de position, de taille ni de pile d'empilement par fiche : `WindowFrame` et la barre des fiches réduites sortent du code ; la planche « Fenêtre flottante » du catalogue est remplacée.
- Un rechargement rend la même disposition (adresse) ; l'agrandissement d'un volet, lui, ne survit pas (état de lecture, comme l'était la réduction).
- Un onglet caché garde sa fiche montée (masquée) : on y revient sans recharger. Le coût en mémoire est celui des fenêtres d'aujourd'hui, toutes montées.
