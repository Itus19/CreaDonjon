# 0118 — Une fiche allégée pour chaque PNJ, dévoilée par indices

**Date :** 2026-11-26
**Statut :** acceptée le 26 novembre 2026 (choix de l'auteur dans le fil « Donner une fiche allégée aux PNJ » : fiche sur le modèle des PNJ du SRD, option A « une table d'indices découverts »). Livrée par V3.2-47 à 52.

## Contexte

Séance du 26 novembre : la personne qui joue cherche à savoir si Mabelle est forte, si elle est armée. Le moteur n'a rien à révéler : un PNJ sans classe n'a qu'une description. Il ne peut pas non plus faire de jet pour lui (soulever, résister, courir) : l'issue serait inventée par le récit, contre la règle 8.

L'auteur veut aussi que le wiki d'une partie reflète **ce que le personnage a découvert**, et rien d'autre : fiches et blocs se dévoilent au fil des indices. Aujourd'hui, en solo, la personne qui joue est propriétaire du monde et voit tout (constat de l'ADR 0117) ; et la découverte (`entity_discoveries`, SCHEMA §13) ne connaît que la fiche entière, pas un détail.

## Options

- **Fiche** : (a) un nouveau type de bloc ; (b) **le bloc `statblock` existant**, valeurs plates, plus la fiche du SRD dont il part. Retenue (b) : le bloc est déjà fait pour « une créature ou un PNJ sans build ».
- **Mémoire des indices** : (A) **une table, par partie, des détails découverts** ; (B) l'état de partie (`campaign_state`). Retenue A par l'auteur : le serveur filtre chaque détail avant l'envoi (règle 5), avec la RLS en dernier filet, et la table sert aussi au jeu avec un MJ humain.

## Décision

1. **La fiche de base vient du SRD 2024** (vingt fiches de PNJ humanoïdes dans `data/srd/srd-2024.json` : Roturier, Noble, Garde, Gros-bras, Éclaireur, Espion, Vétéran, Prêtre, Mage…). Le moteur la choisit d'après l'**archétype de vie** du PNJ (ADR 0115 : artisan, garde, prêtre, enfant…), par une table pure de `src/core`. Ajustements à graine fixe (une forgeronne a plus de Force), jamais inventés par l'IA.
2. **Équipement et bourse** : un bloc `inventory` tiré à graine fixe d'après l'archétype, le milieu social et la richesse de la ville en agrégat (`settlement.wealth`).
3. Les deux blocs naissent **avec la fiche du PNJ** (ancrage d'une esquisse, générateur), en visibilité `gm`.
4. **Table `entity_facet_discoveries`** : partie, entité, personne (`null` : toute la table), **facette** (`ability:str`, `ac`, `hp`, `item:<id>`, `purse`, `action:<nom>`…), événement source. Le serveur construit pour le lecteur joueur une vue du bloc qui ne contient **que** les facettes découvertes ; le reste ne quitte jamais le serveur.
5. **Un jet réussi révèle des facettes** : le moteur choisit lesquelles selon la compétence (Perception : armes et armure visibles, carrure ; Perspicacité : humeur, assurance ; Investigation : bourse, objets cachés) et la marge. L'écran du wiki les montre aussitôt.
6. **Le moteur fait les jets des PNJ** avec ces valeurs ; l'IA propose l'action du PNJ dans une liste fermée, le moteur décide, l'IA raconte l'issue.
7. **En partie solo, le wiki s'affiche en vue joueur** (lecteur `genericPlayerViewer`, même quand on est propriétaire), filtré par les découvertes : c'est le brouillard de guerre de l'ADR 0117.

## Conséquences

- Une migration (table, RLS : lecture par les membres de la partie, écriture par le moteur signé ou le MJ ; refus par défaut).
- Rien de dérivé n'est stocké : `statblock` garde des valeurs plates par conception (SCHEMA §7), la vue joueur se recalcule à chaque lecture.
- **Hors périmètre** : un monde propre à chaque partie. Aujourd'hui une partie solo et une partie à table peuvent partager un monde, donc ses fiches ; les indices, eux, restent séparés par partie. Créer ou copier un monde par partie est un chantier à part, lié à la carte Azgaar propre à chaque partie.

## Amendement du 27 novembre 2026 : l'apparence à part (V3.2-54)

Retour de l'auteur : la description mêlait l'apparence et ce que le PNJ cache. Décision :
- Un premier bloc texte **« Apparence »**, en tête de fiche, lisible : un portrait de 90 à 160 mots (âge, taille, corpulence, cheveux, visage, vêtements, équipement porté, allure), assez précis pour servir de consigne à un générateur d'images. L'IA le rédige une fois par PNJ, après la narration du tour où il est vu, d'après le libellé, la description visible, les objets portés tirés par le moteur et ce que la narration vient de montrer. Elle n'ajoute aucune arme ni armure : l'équipement reste celui du moteur.
- Un détail physique caché proposé par l'IA (un tatouage sous la manche) va dans un bloc **« Ce qui ne se voit pas »**, réservé au MJ, à découvrir.
- Une note du récit (`world_note`) porte un `aspect` (`apparence`, `cache`, `recit`) qui choisit son bloc ; un détail caché n'atterrit jamais dans un bloc lisible.
- Trace : `ai_proposals` `create_block`, appliquée d'office comme les notes du monde (ADR 0114). Coût : un appel d'IA par PNJ, au plus un par tour.
