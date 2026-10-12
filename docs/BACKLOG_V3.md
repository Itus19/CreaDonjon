# Backlog V3 — Le monde qui se joue tout seul

**Version :** 1.0 — 6 septembre 2026 · **Index depuis le 12 octobre 2026**
**Établi sur :** l'état réel du dépôt à `6851a0f`, vérifié fichier par fichier.
**Documents liés :** `specs/moteur-de-jeu.md` · `specs/module-joueur-et-solo.md` · `docs/adr/0009-viabilite-solo.md` · `specs/outils-mj.md` · `specs/psyche-pnj.md` · `docs/SCHEMA.md`

Le mode solo : le moteur joue le MJ, le modèle l'habille (ADR 0009). **Depuis le 12 octobre, ce fichier n'est plus qu'un index**, comme celui de la V3.1 : les tickets vivent dans `docs/backlog-v3/`, un fichier par lot (voir « Où trouver un ticket », en bas). **Ne lis que le fichier du ticket en cours**, plus [`00-cadre.md`](backlog-v3/00-cadre.md) pour un ticket des lots B, C, E ou F.

**Répartition par modèle (ADR 0053).** Une session Opus orchestre. Elle délègue les tickets « Sonnet » à `dev-sonnet`, et la ligne « Sous-tâches Haiku » de chaque ticket ouvert à `aide-haiku` (`.claude/agents/`).

**Lire les titres.** ☑ : ticket terminé. ☐ : il reste du travail, y compris une simple vérification en direct chez l'auteur. Un ticket « fait » dont des points sont reportés ou réservés (et écrits comme tels) est coché. Sous chaque titre, le **modèle conseillé** : *Sonnet* quand le ticket est bien spécifié et local (interface d'après une esquisse décidée, saisie, fonction pure) ; *Opus* quand il faut concevoir, ou qu'il touche au noyau du moteur, à l'IA, au schéma, à la RLS ou à la sécurité. Le critère n'est pas la taille mais le risque et l'ambiguïté : un petit ticket de sécurité va à Opus, un gros écran déjà dessiné à Sonnet.

**Le modèle d'IA, dans chaque titre.**
- **« avec modèle IA »** : le ticket appelle le fournisseur d'IA (`src/server/ai/`, derrière `AiProvider`), ou ne se vérifie qu'avec lui. Il faut donc un modèle joignable pour le coder et le vérifier : le fournisseur local allumé, ou un fournisseur distant configuré (`specs/cible-locale-et-ia.md`). Chaque appel s'écrit dans `ai_usage_log` (règle absolue 13).
- **« sans modèle IA »** : rien n'appelle de modèle. Le ticket se code et se vérifie IA débranchée ; c'est le cas de tout le moteur, qui doit rester jouable sans IA (critère transverse, `00-cadre.md` §3).

Le critère n'est pas « le ticket parle d'IA » : la barre d'intention (B1) est un garde-fou de l'IA, mais un test lui interdit tout appel de modèle, donc elle est « sans ».

---

## Feuille de route (12 octobre) — à lire en premier

### Où en est la V3

**Les lots A, B, C et D sont terminés** : le moteur (déclencheurs, économie d'action, scène), la boucle de tour (intention, résolution, demande de jet, narration), le monde qui s'écrit (générateurs, esquisses, wiki, découvertes, conséquences, météo) et l'écran solo à trois colonnes. **Le lot R l'est presque**, à deux mesures près chez l'auteur.

**Ce qui reste** :
- **Plus aucune mesure en attente.** V3-R6 est fermé le 12 octobre : la liste des règles demandait 10 pages dont 8 vides ; corrigé et remesuré (temps base des règles divisé par 4). V3-R7 est atteint, V3-Z1 repris par V3.1-48. Un ticket facultatif en est sorti : **V3-R8** (les noms traduits, en dix paquets).
- **Les lots E et F**, qui attendent **une vraie partie jouée** : concevoir la mémoire longue avant trois séances réelles, c'est deviner (`00-cadre.md` §2). Leurs tickets ne sont pas encore prêts à coder : ils se conçoivent d'abord (ADR), puis se découpent.

### Ordre recommandé

| Étape | Tickets | Modèle IA | Pourquoi d'abord |
|---|---|---|---|
| ~~0 · Vérifier ce qui est fait~~ | ~~R6, R7~~ | sans | **Faits le 12 octobre.** Facultatif : R8 (noms traduits en un seul appel). |
| ~~0 bis · Sans IA ni partie jouée~~ | ~~F3~~ | sans | **Fait le 12 octobre** (ADR 0058) : un monde solo se copie, il ne se convertit pas. |
| **1 · Jouer** | trois séances solo réelles | avec | E et F se conçoivent à partir de ce qui a manqué en jouant. Noter ce qui gêne : répétitions, oublis d'une séance à l'autre, envie d'annuler un tour. |
| **2 · La mémoire** | E1 → E3 ; E2 (ADR sur la dimension d'embedding d'abord) | avec | E1 borne les tokens quand la partie dure ; E3 s'appuie sur le même journal. E2 est indépendant mais engage le schéma (`SCHEMA.md` §17). |
| **3 · La partie qui dure** | F1 (après E1) ; F2 ; F3 | F1 avec, F2 et F3 sans | F1 réutilise les résumés de E1. F2 et F3 ne dépendent de rien d'autre et peuvent partir dès qu'une partie a montré leur besoin. |

**Règle** : un ticket Opus « à concevoir » ne se code pas ; il se conçoit (ADR), puis il se découpe en tickets prêts. Les questions encore ouvertes du mode solo sont dans `00-cadre.md` §4.

---

## Où trouver un ticket

Les tickets vivent dans `docs/backlog-v3/`, un fichier par lot. **Ne lis que le fichier du ticket en cours** : cette page suffit pour s'orienter.

**Tenir l'index à jour.** Quand un ticket change d'état, change aussi sa ligne ci-dessous. Un ticket qui passe à ☑ est déplacé de son fichier vers `termines.md`, rangé par lot. Un ticket nouveau s'écrit dans le fichier de son lot, avec « avec modèle IA » ou « sans modèle IA » dans son titre, et une ligne s'ajoute ici.

- [`00-cadre.md`](backlog-v3/00-cadre.md) — Le cadre commun : ce que S1 a changé, l'inventaire de l'existant, le séquencement, les critères transverses, les questions ouvertes, la méthode
- [`01-moteur.md`](backlog-v3/01-moteur.md) — Lot A : le moteur (terminé)
- [`02-boucle-de-tour.md`](backlog-v3/02-boucle-de-tour.md) — Lot B : la boucle de tour (terminé)
- [`03-monde-qui-s-ecrit.md`](backlog-v3/03-monde-qui-s-ecrit.md) — Lot C : le monde qui s'écrit, et sa hiérarchie des sources (terminé)
- [`04-interface-solo.md`](backlog-v3/04-interface-solo.md) — Lot D : l'interface solo, et son dessin (terminé)
- [`05-memoire.md`](backlog-v3/05-memoire.md) — Lot E : la mémoire (E1 à E3)
- [`06-partie-qui-dure.md`](backlog-v3/06-partie-qui-dure.md) — Lot F : la partie qui dure (F1 à F3)
- [`07-rapidite-telephone.md`](backlog-v3/07-rapidite-telephone.md) — Lot R : la rapidité, et le téléphone (R8, ordre de traitement)
- [`08-fiche-revelee-par-le-solo.md`](backlog-v3/08-fiche-revelee-par-le-solo.md) — Lot Z : ce que le mode solo a révélé sur la fiche (terminé ; Z1 repris par V3.1-48)
- [`termines.md`](backlog-v3/termines.md) — Tickets terminés (☑), S2 compris

| Ticket | État | Modèle IA | Titre | Fichier |
|---|---|---|---|---|
| V3-S2 | ☑ | **avec** | Reboucler le lien fait-mécanique → narration | [`termines.md`](backlog-v3/termines.md) |
| V3-A1 | ☑ | sans | Déclencheurs : schéma, évaluateur, bornes | [`termines.md`](backlog-v3/termines.md) |
| V3-A2 | ☑ | sans | Brancher le vocabulaire d'événements | [`termines.md`](backlog-v3/termines.md) |
| V3-A3 | ☑ | sans | Économie d'action | [`termines.md`](backlog-v3/termines.md) |
| V3-A4 | ☑ | sans | État de scène et zones abstraites | [`termines.md`](backlog-v3/termines.md) |
| V3-A5 | ☑ | sans | Éditeur de déclencheurs au formulaire | [`termines.md`](backlog-v3/termines.md) |
| V3-A6 | ☑ | sans | Convertir les règles SRD qui ont des déclencheurs | [`termines.md`](backlog-v3/termines.md) |
| V3-B1 | ☑ | sans | La barre d'intention | [`termines.md`](backlog-v3/termines.md) |
| V3-B2 | ☑ | **avec** | Le tour, de bout en bout | [`termines.md`](backlog-v3/termines.md) |
| V3-B3 | ☑ | **avec** | Le contexte envoyé au modèle | [`termines.md`](backlog-v3/termines.md) |
| V3-B4 | ☑ | **avec** | Varier la narration | [`termines.md`](backlog-v3/termines.md) |
| V3-B5 | ☑ | sans | Le moteur demande un jet, il ne le lance pas | [`termines.md`](backlog-v3/termines.md) |
| V3-C1 | ☑ | sans | Le pont générateur ↔ moteur | [`termines.md`](backlog-v3/termines.md) |
| V3-C2 | ☑ | **avec** | Esquisses de scène | [`termines.md`](backlog-v3/termines.md) |
| V3-C3 | ☑ | **avec** | Écrire dans le wiki en jouant | [`termines.md`](backlog-v3/termines.md) |
| V3-C4 | ☑ | sans | Le wiki qui se découvre | [`termines.md`](backlog-v3/termines.md) |
| V3-C5 | ☑ | sans | Le tiroir de conséquences | [`termines.md`](backlog-v3/termines.md) |
| V3-C6 | ☑ | sans | La météo, le temps, le monde qui bouge | [`termines.md`](backlog-v3/termines.md) |
| V3-D1 | ☑ | sans | La coquille à trois colonnes | [`termines.md`](backlog-v3/termines.md) |
| V3-D2 | ☑ | sans | L'en-tête d'état | [`termines.md`](backlog-v3/termines.md) |
| V3-D3 | ☑ | sans | La colonne gauche : le monde connu | [`termines.md`](backlog-v3/termines.md) |
| V3-D4 | ☑ | **avec** | La colonne centrale : le fil et la saisie | [`termines.md`](backlog-v3/termines.md) |
| V3-D5 | ☑ | sans | La colonne droite : la fiche jouable | [`termines.md`](backlog-v3/termines.md) |
| V3-D6 | ☑ | sans | Ce qui vient d'où | [`termines.md`](backlog-v3/termines.md) |
| V3-E1 | ☐ | **avec** | Résumé de scène | [`05-memoire.md`](backlog-v3/05-memoire.md) |
| V3-E2 | ☐ | **avec** | RAG sur le wiki | [`05-memoire.md`](backlog-v3/05-memoire.md) |
| V3-E3 | ☐ | **avec** | Le journal de personnage | [`05-memoire.md`](backlog-v3/05-memoire.md) |
| V3-F1 | ☐ | **avec** | Reprendre une partie | [`06-partie-qui-dure.md`](backlog-v3/06-partie-qui-dure.md) |
| V3-F2 | ☐ | sans | Annuler un tour | [`06-partie-qui-dure.md`](backlog-v3/06-partie-qui-dure.md) |
| V3-F3 | ☑ | sans | Copier le wiki d'un monde, sans jamais convertir une partie solo | [`termines.md`](backlog-v3/termines.md) |
| V3-R0 | ☑ | sans | Poser la mesure et le budget | [`termines.md`](backlog-v3/termines.md) |
| V3-R1 | ☑ | sans | Ne plus livrer le bureau à fenêtres au téléphone | [`termines.md`](backlog-v3/termines.md) |
| V3-R2 | ☑ | sans | Le premier rendu ne suppose plus un grand écran | [`termines.md`](backlog-v3/termines.md) |
| V3-R3 | ☑ | sans | Découper les éditeurs de blocs | [`termines.md`](backlog-v3/termines.md) |
| V3-R4 | ☑ | sans | Les images à la taille du téléphone | [`termines.md`](backlog-v3/termines.md) |
| V3-R5 | ☑ | sans | Supprimer les cascades de chargement | [`termines.md`](backlog-v3/termines.md) |
| V3-R6 | ☑ | sans | Les deux chiffres que seul l'auteur peut lire | [`termines.md`](backlog-v3/termines.md) |
| V3-R8 | ☐ | sans | Les noms traduits des règles, en dix paquets | [`07-rapidite-telephone.md`](backlog-v3/07-rapidite-telephone.md) |
| V3-R7 | ☑ | sans | Deux boucles qui rechargent les règles une par une | [`termines.md`](backlog-v3/termines.md) |
| V3-Z1 | ☑ | sans | L'âge du personnage, et l'identité à la création | [`termines.md`](backlog-v3/termines.md) |
