# 0109 — La génération du monde démarre

**Date :** 2026-11-25
**Statut :** acceptée (l'auteur a choisi le chemin « spec puis ville en agrégat » le 25 novembre ; les décisions G1 à G5 sont relues avec la PR qui les introduit)

## Contexte

L'ADR 0104 a fixé la direction de la génération du monde (Azgaar, méthode de Dwarf Fortress, villes en agrégats, espaces, catalogue). Deux verrous empêchaient pourtant d'écrire le moindre ticket : `ROADMAP.md` (« aucune [de ces lignes] ne devient un ticket tant que la V3 n'est pas jouable ») et le Backlog du mode solo (« pas avant que les familles A, B et C tiennent sur trois séances »). Et cinq choix qui engagent le schéma restaient ouverts.

## Options envisagées

- **A.** Garder le verrou : la génération attend que le tour solo tienne. Prudent, mais repousse de plusieurs semaines un travail qui ne dépend pas du tour.
- **B.** Lever le verrou pour le **noyau pur** seulement, sans toucher au tour solo ni aux prompts. Retenu.
- **C.** Lever le verrou entièrement, y compris le branchement sur le solo. Risque de construire sur un tour dont le contexte est encore trop mince.

## Décision

**B.** La génération du monde avance dans `src/core/worldgen/`, en parallèle des étapes 1 et 2 du Backlog solo. Son branchement sur le tour (ticket G-4 de `specs/generation-du-monde.md`) attend que ces étapes tiennent.

Les cinq choix :

- **G1.** Une ville est un **bloc `settlement`** sur l'entité du lieu, sans table nouvelle : le modèle unifié (une entité, ses blocs) s'applique aux villes comme au reste.
- **G2.** Azgaar entre par son **export JSON**, pas par son code : aucune dépendance, et sa carte s'affiche déjà comme image.
- **G3.** Le simulateur d'histoire est **pur** et tourne dans le navigateur ou un script local, jamais dans une route `/api` ; le résultat s'écrit en une fois, sous un plafond d'événements.
- **G4.** Les biomes sont **la liste fermée d'Azgaar** (treize), pour que l'import s'y branche sans traduction.
- **G5.** Le catalogue est fait de **fiches de règles** avec un nouveau type et un bloc « élément du monde », pas d'une table à part.

Et deux arbitrages entre documents :

- La chronique est **figée au lancement** (ADR 0104 §7). Le monde qui « continue à évoluer » du PDD §13 est remis à plus tard.
- Une graine permet de **régénérer seulement avant le figement** ; après, le wiki l'emporte (ADR 0104 §2).

## Conséquences

- `specs/generation-du-monde.md` devient la référence de la V4 ; `ROADMAP.md` le dit.
- Les parties d'un lieu s'appellent **espaces** (`space`), jamais « zones », mot déjà pris par les distances de scène et les régions de carte.
- Le catalogue (G5) demandera une migration et une mise à jour de `docs/SCHEMA.md` à son ticket. Le bloc `settlement` n'en demande pas : `blocks.block_type` n'a pas de contrainte, c'est le registre Zod qui fait foi.
- Le bloc `settlement` est dans le registre des blocs depuis le ticket G-3 : il se pose et s'édite sur une fiche (famille Outils).
- **L'histoire passe avant la carte** (décidé avec l'auteur le 26 novembre) : le simulateur travaille sur un monde abstrait calqué sur l'export d'Azgaar, testé sur un monde écrit à la main ; l'import Azgaar vient ensuite le remplir. La simulation doit aboutir au présent que montre la carte.
