# Backlog V4 — Le monde qui vit

**Version :** 1.0 — 22 octobre 2026
**Établi sur :** la discussion du 22 octobre 2026 avec l'auteur, en supposant faits tous les tickets des backlogs antérieurs (`backlog-v4/00-cadre.md` §1).
**Documents liés :** `specs/psyche-v4.md` · `specs/simulation-monde.md` · `docs/recherche/simulation-inspirations.md` · ADR 0067 à 0084 · `specs/psyche-pnj.md` (que la V4 remplace en partie) · `specs/moteur-de-jeu.md` · `docs/adr/0009-viabilite-solo.md` · `docs/adr/0048-les-donnees-de-la-chronologie.md` · `docs/adr/0058-un-monde-solo-se-copie-il-ne-se-convertit-pas.md`

Un **moteur de simulation** : des entités qui ont des traits, des valeurs, des besoins, des rêves, des émotions et des souvenirs, qui agissent selon eux, se transforment, se souviennent du joueur, et laissent une histoire. Un monde qui **naît avec une histoire générée** à partir d'une graine. Des outils **hybrides** : le MJ humain active ou non la simulation, et accepte ou rejette ce qu'elle propose. L'IA ne fait que raconter. Inspiration : Dwarf Fortress, Fable, Baldur's Gate 2, le système Nemesis.

**Ce fichier est un index**, comme ceux de la V3 et de la V3.1. Les tickets vivent dans `docs/backlog-v4/`, un fichier par lot. **Ne lis que le fichier du ticket en cours**, plus [`00-cadre.md`](backlog-v4/00-cadre.md), dont les critères transverses valent pour tous.

**Répartition par modèle (ADR 0053).** Une session Opus orchestre. Elle délègue les tickets « Sonnet » à `dev-sonnet`, et la ligne « Sous-tâches Haiku » de chaque ticket à `aide-haiku` (`.claude/agents/`).

**Lire les titres.** ☑ : terminé. ☐ : il reste du travail. Sous chaque titre, le **modèle conseillé** (*Sonnet* : bien spécifié et local ; *Opus* : noyau du moteur, IA, schéma, RLS, sécurité), l'ADR et la section de spec, et les dépendances (« prêt après… »). Un ticket d'interface a pour première sous-tâche son **esquisse**, validée par l'auteur.

**Le modèle d'IA, dans chaque titre** (même règle que `docs/BACKLOG_V3.md`). Presque toute la V4 est « sans modèle IA » : la simulation est du code. Deux tickets seulement appellent un modèle : B9 (la psyché dans le contexte) et E10 (raconter ce que le monde a fait).

---

## Feuille de route — à lire en premier

### Ce qui change dans l'existant

La V4 renverse deux décisions de `specs/psyche-pnj.md`, chacune par un ADR (`00-cadre.md` §3) :

- **« Pas de dérive de fond »** devient **« le temps qui passe est un événement »**. Toujours aucune tâche de fond : le monde est rattrapé quand le temps avance en jeu (ADR 0069).
- **« Bram est Bram partout »** devient **« le bloc est la graine, l’état courant vit dans la partie »** (ADR 0067).

### Où en est la V4

**Conçue le 22 octobre 2026.** La recherche (`docs/recherche/simulation-inspirations.md` : Dwarf Fortress par DFHack et son wiki, RimWorld, Crusader Kings III, Les Sims, Talk of the Town, Nemesis, Wildermyth, Ultima IV, Caves of Qud, l'IA par utilité), les deux specs (`specs/psyche-v4.md`, `specs/simulation-monde.md`) et les ADR 0067 à 0084 sont écrits. **Les 62 tickets sont prêts** ; ceux d'interface commencent par une esquisse à faire valider. Quelques choix restent à confirmer par l'auteur : `specs/simulation-monde.md` §17.

### Ordre recommandé

| Étape | Tickets | Pourquoi |
|---|---|---|
| **1 · Le noyau de base** | A1, A2, B1, B2, A4 | hasard, horloge, listes, blocs, vocabulaire : tout le reste les lit |
| **2 · Les tables et l'existant** | A3, B3, B4, B6, H1 | les tables, la conversion des PNJ actuels, l'identité, les réglages et la projection du joueur |
| **3 · Le questionnaire (noyau)** | D1, D2, D3 | rend la psyché saisissable, et D3 sert la génération |
| **4 · La vie, en noyau pur** | E3, E1, C1, E2, C2, C3, C4, E4, E5, E7, E8 | tests d'abord, tout en millisecondes |
| **5 · Les figures et les croyances** | E6, C5, C6, C8, A6 | promotion, croyances, réputation, pont du jeu |
| **6 · Le pas de simulation** | E9, puis A8 | tout s'assemble ; puis on mesure et on fixe les bornes |
| **7 · Le MJ** | F1, F2, F3, F5, F4, F6 | le mode hybride |
| **8 · Les écrans** | B5, B7, B8, C7, D4, D5, H2, H3, H5, H7, A7, A5 | chacun après son esquisse |
| **9 · Les règles et le jeu** | H4, H6 | conséquences du corps, motif et Inspiration |
| **10 · Raconter** | B9, E10 | **avec modèle IA** |
| **11 · Générer le monde** | G1, G2, G3, G4, G5, G6, G7, G8 | la simulation tourne : on la fait tourner des siècles |
| **Plus tard** | D6 ; le lot P (échelle politique) | quand le besoin se confirme |

---

## Où trouver un ticket

- [`00-cadre.md`](backlog-v4/00-cadre.md) — Le cadre commun : intention, point de départ supposé, ce qui existe, ce qui change, critères transverses, ce qu'on emprunte à Dwarf Fortress, questions ouvertes
- [`01-fondations.md`](backlog-v4/01-fondations.md) — Lot A : hasard dérivé, horloge et lunette, tables, vocabulaire du monde, listes du monde, pont du jeu vers le monde, budget
- [`02-psyche.md`](backlog-v4/02-psyche.md) — Lot B : facettes, valeurs, besoins, rêves, émotions ; identité et orientations ; conversion de l'existant
- [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) — Lot C : souvenirs, relations tirées des souvenirs, croyances et rumeurs, mémoire du joueur
- [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) — Lot D : le questionnaire, pour le joueur, le MJ et le moteur
- [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) — Lot E : évaluation, besoins, actions, transformation, figures légères et complètes, l'intime, le pas de simulation
- [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) — Lot F : activer, figer, le simulateur, rejeter une chaîne, ce qui bouge
- [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) — Lot G : graine, paramètres de départ, histoire simulée, légendes
- [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) — Lot H : réglages de table, psyché vue par le joueur, conséquences de règles, Inspiration
- [`termines.md`](backlog-v4/termines.md) — Tickets terminés (☑)

| Ticket | État | Modèle | Modèle IA | Titre | Fichier |
|---|---|---|---|---|---|
| V4-A1 | ☐ | Opus | sans | Le hasard dérivé | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A2 | ☐ | Opus | sans | L'horloge du monde et la lunette | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A3 | ☐ | Opus | sans | Les tables de la simulation | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A4 | ☐ | Opus | sans | Le vocabulaire du monde | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A5 | ☐ | Opus | sans | Les listes du monde | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A6 | ☐ | Opus | sans | Le pont du jeu vers le monde | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A7 | ☐ | Sonnet | sans | Saisir un fait marquant | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A8 | ☐ | Opus | sans | Le budget de la simulation | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-B1 | ☐ | Opus | sans | Les listes de la psyché dans le noyau | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B2 | ☐ | Opus | sans | Les blocs de graine en version 2 | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B3 | ☐ | Opus | sans | Convertir l'existant | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B4 | ☐ | Opus | sans | Identité et orientations : les données | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B5 | ☐ | Sonnet | sans | Identité et orientations : le formulaire | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B6 | ☐ | Opus | sans | Poids des besoins et rêves de départ | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B7 | ☐ | Sonnet | sans | Éditer la graine à la main | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B8 | ☐ | Sonnet | sans | La psyché sur la fiche | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B9 | ☐ | Opus | **avec** | La psyché dans le contexte du modèle | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-C1 | ☐ | Opus | sans | Les souvenirs | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C2 | ☐ | Opus | sans | Les souvenirs fondateurs | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C3 | ☐ | Opus | sans | Familiarité, quotidien et compatibilité | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C4 | ☐ | Opus | sans | Les liens nommés | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C5 | ☐ | Opus | sans | Les croyances | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C6 | ☐ | Sonnet | sans | La réputation | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C7 | ☐ | Sonnet | sans | Souvenirs, croyances et liens sur la fiche | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C8 | ☐ | Opus | sans | La mémoire du joueur | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-D1 | ☐ | Opus | sans | Le format et le questionnaire par défaut | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D2 | ☐ | Opus | sans | Appliquer des réponses | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D3 | ☐ | Opus | sans | Le moteur répond lui-même | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D4 | ☐ | Sonnet | sans | Le questionnaire du joueur | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D5 | ☐ | Sonnet | sans | Le questionnaire du MJ | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D6 | ☐ | Sonnet | sans | Écrire ses propres questions | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-E1 | ☐ | Opus | sans | L'évaluation | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E2 | ☐ | Opus | sans | Humeur, stress, crises et élan | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E3 | ☐ | Opus | sans | Les besoins | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E4 | ☐ | Opus | sans | Les actions et le score d'utilité | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E5 | ☐ | Opus | sans | Les rêves qui naissent et qui meurent | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E6 | ☐ | Opus | sans | Figures légères et complètes | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E7 | ☐ | Opus | sans | L'intime | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E8 | ☐ | Opus | sans | La vie des figures légères | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E9 | ☐ | Opus | sans | Le pas de simulation | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E10 | ☐ | Opus | **avec** | Raconter ce que le monde a fait | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-F1 | ☐ | Opus | sans | Activer la simulation | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F2 | ☐ | Sonnet | sans | Une figure figée | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F3 | ☐ | Opus | sans | Les lots proposés | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F4 | ☐ | Sonnet | sans | Le simulateur | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F5 | ☐ | Opus | sans | Défaire le dernier lot | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F6 | ☐ | Sonnet | sans | Ce qui bouge dans le monde | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-G1 | ☐ | Opus | sans | Graine et paramètres | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G2 | ☐ | Opus | sans | Peuples, cultures et lieux | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G3 | ☐ | Opus | sans | La boucle d'histoire | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G4 | ☐ | Opus | sans | Le Web Worker et l'envoi par morceaux | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G5 | ☐ | Sonnet | sans | L'écran de génération | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G6 | ☐ | Sonnet | sans | La chronique et les légendes | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G7 | ☐ | Sonnet | sans | Réutiliser une graine | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G8 | ☐ | Sonnet | sans | Générer pour un MJ | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-H1 | ☐ | Opus | sans | Les réglages et la projection du joueur | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H2 | ☐ | Sonnet | sans | L'écran des réglages | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H3 | ☐ | Sonnet | sans | La psyché du PJ vue par son joueur | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H4 | ☐ | Opus | sans | Les besoins du corps et les déclencheurs | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H5 | ☐ | Sonnet | sans | Proposer une transformation au joueur | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H6 | ☐ | Opus | sans | Le motif déclaré et l'Inspiration | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H7 | ☐ | Sonnet | sans | Ce que le MJ voit pour raconter | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
