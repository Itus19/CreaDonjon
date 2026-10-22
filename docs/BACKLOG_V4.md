# Backlog V4 — Le monde qui vit

**Version :** 1.0 — 22 octobre 2026
**Établi sur :** la discussion du 22 octobre 2026 avec l'auteur, en supposant faits tous les tickets des backlogs antérieurs (`backlog-v4/00-cadre.md` §1).
**Documents liés :** `specs/psyche-pnj.md` (que la V4 remplace en partie) · `specs/moteur-de-jeu.md` · `docs/adr/0009-viabilite-solo.md` · `docs/adr/0048-les-donnees-de-la-chronologie.md` · `docs/adr/0058-un-monde-solo-se-copie-il-ne-se-convertit-pas.md`

Un **moteur de simulation** : des entités qui ont des traits, des valeurs, des besoins, des rêves, des émotions et des souvenirs, qui agissent selon eux, se transforment, se souviennent du joueur, et laissent une histoire. Un monde qui **naît avec une histoire générée** à partir d'une graine. Des outils **hybrides** : le MJ humain active ou non la simulation, et accepte ou rejette ce qu'elle propose. L'IA ne fait que raconter. Inspiration : Dwarf Fortress, Fable, Baldur's Gate 2, le système Nemesis.

**Ce fichier est un index**, comme ceux de la V3 et de la V3.1. Les tickets vivent dans `docs/backlog-v4/`, un fichier par lot. **Ne lis que le fichier du ticket en cours**, plus [`00-cadre.md`](backlog-v4/00-cadre.md), dont les critères transverses valent pour tous.

**Répartition par modèle (ADR 0053).** Une session Opus orchestre. Elle délègue les tickets « Sonnet » à `dev-sonnet`, et la ligne « Sous-tâches Haiku » de chaque ticket à `aide-haiku` (`.claude/agents/`).

**Lire les titres.** ☑ : terminé. ☐ : il reste du travail. Sous chaque titre, le **modèle conseillé** (*Sonnet* : bien spécifié et local ; *Opus* : conception, noyau du moteur, IA, schéma, RLS, sécurité) et l'état : **à concevoir** (produit un ADR ou une spec, puis se découpe ; ne se code pas), **à esquisser** (un écran à dessiner avec l'auteur avant le code), **prêt** (se code).

**Le modèle d'IA, dans chaque titre** (même règle que `docs/BACKLOG_V3.md`). Presque toute la V4 est « sans modèle IA » : la simulation est du code. Trois tickets seulement appellent un modèle (B6, E9, et par eux la narration).

---

## Feuille de route — à lire en premier

### Ce qui change dans l'existant

La V4 renverse deux décisions de `specs/psyche-pnj.md`, chacune par un ADR (`00-cadre.md` §3) :

- **« Pas de dérive de fond »** devient **« le temps qui passe est un événement »**. Toujours aucune tâche de fond : le monde est rattrapé quand le temps avance en jeu (A3).
- **« Bram est Bram partout »** devient **« le bloc est la graine, l'état courant vit dans la partie »** (A1).

### Ordre recommandé

| Étape | Tickets | Pourquoi d'abord |
|---|---|---|
| **1 · Concevoir les fondations** | A1, A3, A4, A6 (ADR) ; A2 (prêt) | tout le reste en dépend ; A2 est petit et se code tout de suite |
| **2 · Concevoir la psyché** | B1 (la spec) | fixe les listes et les échelles que tous les lots lisent |
| **3 · Concevoir la vie** | C1, C4, E1, E6 (ADR) | la mémoire, les croyances, l'évaluation, les deux niveaux de figures |
| **4 · La psyché, codée** | B2, B3, B4, puis B5 | la conversion de l'existant (B3) arrive tôt : l'auteur garde ses PNJ |
| **5 · Le questionnaire** | D1, D2, D5, puis D3 et D4 | rend la richesse supportable à la saisie ; D5 sert ensuite le lot G |
| **6 · La boucle de vie** | E2, E3, C2, C3, E4, E5, E7, C6, puis E8 | le cœur ; E8 orchestre le tout |
| **7 · La table** | H1, puis H2, H3, H4, H6 ; H5 à concevoir | avant que la simulation touche aux PJ |
| **8 · Le MJ** | F1, F2, F3, F4, F5 | le mode hybride |
| **9 · Raconter** | B6, E9 | **avec modèle IA** ; seulement quand il y a quelque chose à raconter |
| **10 · Générer le monde** | G1 (ADR), G2, G3, G4, G5, G6, G7 | la simulation tourne : on la fait tourner des siècles |
| **Après** | lot P, l'échelle politique | royaumes, flux de population, économie. **Pas un ticket** avant que les lots A à G tournent |

**Règle** : un ticket « à concevoir » ne se code pas. Il produit son ADR, puis se découpe en tickets prêts, écrits dans le fichier de son lot.

---

## Où trouver un ticket

- [`00-cadre.md`](backlog-v4/00-cadre.md) — Le cadre commun : intention, point de départ supposé, ce qui existe, ce qui change, critères transverses, ce qu'on emprunte à Dwarf Fortress, questions ouvertes
- [`01-fondations.md`](backlog-v4/01-fondations.md) — Lot A : psyché dans la partie, hasard dérivé, temps qui passe, journal du monde, budget, listes du monde
- [`02-psyche.md`](backlog-v4/02-psyche.md) — Lot B : facettes, valeurs, besoins, rêves, émotions ; identité et orientations ; conversion de l'existant
- [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) — Lot C : souvenirs, relations tirées des souvenirs, croyances et rumeurs, mémoire du joueur
- [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) — Lot D : le questionnaire, pour le joueur, le MJ et le moteur
- [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) — Lot E : évaluation, besoins, actions, transformation, figures légères et complètes, l'intime, le pas de simulation
- [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) — Lot F : activer, figer, le simulateur, rejeter une chaîne, ce qui bouge
- [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) — Lot G : graine, paramètres de départ, histoire simulée, légendes
- [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) — Lot H : réglages de table, psyché vue par le joueur, conséquences de règles, Inspiration
- [`termines.md`](backlog-v4/termines.md) — Tickets terminés (☑)

| Ticket | État | Modèle IA | Titre | Fichier |
|---|---|---|---|---|
| V4-A1 | ☐ | sans | La psyché vit dans la partie (ADR) | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A2 | ☐ | sans | Le hasard dérivé | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A3 | ☐ | sans | Le temps qui passe est un événement (ADR) | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A4 | ☐ | sans | Le journal du monde (ADR) | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A5 | ☐ | sans | Le budget de la simulation | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-A6 | ☐ | sans | Les listes du monde | [`01-fondations.md`](backlog-v4/01-fondations.md) |
| V4-B1 | ☐ | sans | La spec de la psyché V4 | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B2 | ☐ | sans | Les blocs de la psyché, dans le noyau | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B3 | ☐ | sans | Convertir l'existant | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B4 | ☐ | sans | Identité et orientations | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B5 | ☐ | sans | La psyché sur la fiche | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-B6 | ☐ | **avec** | La psyché dans le contexte du modèle | [`02-psyche.md`](backlog-v4/02-psyche.md) |
| V4-C1 | ☐ | sans | Le souvenir (ADR) | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C2 | ☐ | sans | Consolider, oublier, raviver | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C3 | ☐ | sans | Des relations qui naissent des souvenirs | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C4 | ☐ | sans | Croyances et rumeurs (ADR) | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C5 | ☐ | sans | Souvenirs et croyances sur la fiche | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-C6 | ☐ | sans | La mémoire du joueur | [`03-memoire-et-relations.md`](backlog-v4/03-memoire-et-relations.md) |
| V4-D1 | ☐ | sans | Le questionnaire, en données | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D2 | ☐ | sans | Appliquer des réponses | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D3 | ☐ | sans | Le questionnaire du joueur | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D4 | ☐ | sans | Le questionnaire du MJ | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D5 | ☐ | sans | Le moteur répond lui-même | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-D6 | ☐ | sans | Écrire ses propres questions | [`04-assistant-de-creation.md`](backlog-v4/04-assistant-de-creation.md) |
| V4-E1 | ☐ | sans | Évaluer un événement (ADR) | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E2 | ☐ | sans | Émotions et stress, dans le noyau | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E3 | ☐ | sans | Les besoins | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E4 | ☐ | sans | Agir : les actions de vie et le choix par utilité | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E5 | ☐ | sans | Se transformer | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E6 | ☐ | sans | Figures légères et figures complètes (ADR) | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E7 | ☐ | sans | L'intime : attirance, couples, exclusivité | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E8 | ☐ | sans | Le pas de simulation | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-E9 | ☐ | **avec** | Raconter ce que le monde a fait | [`05-boucle-de-vie.md`](backlog-v4/05-boucle-de-vie.md) |
| V4-F1 | ☐ | sans | Activer la simulation | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F2 | ☐ | sans | Une entité figée par le MJ | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F3 | ☐ | sans | Le simulateur | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F4 | ☐ | sans | Rejeter une chaîne de conséquences | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-F5 | ☐ | sans | Ce qui bouge dans le monde | [`06-simulation-et-mj.md`](backlog-v4/06-simulation-et-mj.md) |
| V4-G1 | ☐ | sans | Ce qu'est une graine, et où tourne la génération (ADR) | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G2 | ☐ | sans | Les paramètres de départ | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G3 | ☐ | sans | Les peuples, les lieux et les premières figures | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G4 | ☐ | sans | Simuler l'histoire | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G5 | ☐ | sans | La chronique et les légendes | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G6 | ☐ | sans | Réutiliser une graine | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-G7 | ☐ | sans | Générer pour un MJ | [`07-generation-du-monde.md`](backlog-v4/07-generation-du-monde.md) |
| V4-H1 | ☐ | sans | Les réglages de table | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H2 | ☐ | sans | La psyché du PJ, vue par son joueur | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H3 | ☐ | sans | Des besoins qui ont des conséquences de règles | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H4 | ☐ | sans | Proposer une transformation au joueur | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H5 | ☐ | sans | Jouer sa psyché rapporte l'Inspiration | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
| V4-H6 | ☐ | sans | Ce que le MJ voit pour raconter | [`08-pj-et-table.md`](backlog-v4/08-pj-et-table.md) |
