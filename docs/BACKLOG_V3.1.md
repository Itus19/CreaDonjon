# Backlog V3.1 — Rugosités trouvées en jouant

**Version :** 1.0 — 27 septembre 2026

Différent de V2 et V3 : pas de lots planifiés à l'avance, pas de découpage en
phases. Ce backlog recueille les petites corrections trouvées **au fil de
l'utilisation réelle** de l'outil — un formulaire qui coince sur un cas
concret, un avertissement qui ment, un détail qui gêne à la table. Un ticket
s'y ajoute quand quelque chose de ce genre est constaté, pas quand il est
planifié. Taille attendue : `S` ou `M` presque toujours — si un ticket ici
grossit au point de devenir un vrai chantier, il migre vers V2 ou V3.
**Exception assumée** : la refonte « verre minéral » (V3.1-19) est née ici
et y est restée, avec ses tickets V3.1-20 à 119 ; la feuille de route
ci-dessous l'ordonne. **Depuis le 10 octobre, ce fichier n'est plus qu'un index** : les tickets vivent dans `docs/backlog-v3.1/` (voir « Où trouver un ticket », en bas).

**Répartition par modèle (ADR 0053).** Une session Opus orchestre. Elle
délègue les tickets « Sonnet » à `dev-sonnet`, et la ligne « Sous-tâches
Haiku » de chaque ticket prêt à `aide-haiku` (`.claude/agents/`).

**Lire les titres.** ☑ : ticket terminé. ☐ : il reste du travail, y compris
une simple vérification en direct chez l'auteur. Un ticket « fait » dont des
points sont reportés ou réservés (et écrits comme tels) est coché. Sous chaque
titre, le **modèle conseillé** : *Sonnet* quand le ticket est bien spécifié et
local (interface d'après une esquisse décidée, saisie, fonction pure) ; *Opus*
quand il faut concevoir, ou qu'il touche au noyau du moteur, à l'IA, au schéma,
à la RLS ou à la sécurité. Le critère n'est pas la taille mais le risque et
l'ambiguïté : un petit ticket de sécurité va à Opus, un gros écran déjà dessiné
à Sonnet.

---

## Feuille de route (9 octobre) — à lire en premier

### Où en est la refonte

**Tous les écrans de la refonte « verre minéral » sont décidés** (V3.1-19 :
lots a à h, lot i des outils du MJ, la Création, la fiche du wiki et ses
blocs, Règles sur ordinateur, Chronologie du monde, Compte, Choix du
personnage, Écrans d'entrée et marque « Antre Nous », Administration,
statistiques du volet « Je joue »). Chaque décision a sa planche
« Décidé » sur le canevas https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm.

Ce qui n'est **pas** encore prêt à coder :
- **Règles sur ordinateur et Chronologie du monde** sont découpées
  (V3.1-93 à 99) ; la Chronologie attend sa conception de données (V3.1-96,
  Opus : la portée d'un événement, où vit un événement ajouté directement,
  l'agrégation des naissances et des morts).
- **Conception faite le 9 octobre** (ADR 0040 à 0049) : les anciens « à
  concevoir » sont découpés en V3.1-101 à 119 (section « Conception du 9
  octobre », `backlog-v3.1/09-conception-9-octobre.md`). Plus aucun n'est bloqué : l'auteur a choisi
  l'option B de l'ADR 0041 (changements signés) le 10 octobre. Pour mémoire, l'ancienne liste : V3.1-100, V3.1-21 (cibler et résoudre), 23 (droits des joueurs), 37
  (initiative côté joueurs, RLS), 39 (sauvegardes demandées à la cible), 40
  (ressources de classe), 47 (règles de personnage en données), 59 (fond par
  défaut du wiki). Et des tickets de données Opus déjà spécifiés : 41, 74,
  84, 89.
- **Des rugosités d'avant la refonte**, hors interface : **codées le 9
  octobre** : V3.1-1, 2, 4, 5 et 12 (reste leur vérification en direct). V3.1-3, 6 et 7 sont conçus (ADR 0046) et
  repris par 116 à 119. **Reste V3.1-13** (sous-classes manquantes) : c'est
  de la saisie, qui attend le texte des livres de l'auteur. V3.1-14 est
  fermé, repris par 82, 83 et 100.
- **Alias `self` des déclencheurs, corrigé le 9 octobre.** Les formulaires
  et les données SRD écrivent `who: "self"`, mais le serveur nomme les
  acteurs par leur identifiant. Hors repos, une condition sur `self`
  échouait (« acteur absent ») et un effet sur `self` ne s'appliquait à
  personne. `bindSelf` (`triggers.ts`) remplace l'alias par le **porteur de
  la règle** : le personnage, ou, en combat, le participant dont le tour
  commence. 4 tests dans `triggers.test.ts`.
- **Deux failles corrigées le 9 octobre** en préparant V3.1-12 :
  - ADR 0051 : le retour de « voir comme » prenait le compte dont
    l'identifiant était dans un cookie forgeable ;
  - ADR 0052 : « Forcer une réinitialisation » marchait sur n'importe quel
    compte.
  V3.1-15 et 16 sont faits et vérifiés en direct le 9 octobre (leurs
  écrans seront refaits au verre minéral par 54 et 56).

### Ordre recommandé

Chaque étape s'appuie sur la précédente ; à l'intérieur d'une étape, l'ordre
est celui des flèches, et les tickets séparés par des virgules peuvent partir
en parallèle. Les ordres détaillés de chaque partie (dans son fichier) restent
valables ; celui-ci les relie.

| Étape | Tickets | Pourquoi d'abord |
|---|---|---|
| **0 · Sécurité et mesure** | **101** (Opus : `combats` lisible et modifiable par tout membre du monde, routes sans contrôle MJ — une fuite), **108** (Opus : l'état de jeu modifiable par tout membre du monde), **62** étapes 1-2 (mesurer avant de recâbler) | Un défaut de sécurité passe avant tout ; la mesure dit où la rapidité se perd avant qu'on reconstruise les écrans. |
| **1 · Les données que les écrans attendent** (Opus, en parallèle) | **120** (cycles d'import, Sonnet : avant de toucher la fiche jouable et les services), 24 (services de jeu, Sonnet), 84 (identité de l'application), 41 (page partagée), 59 (fond par défaut), 115 → 116 → 117 (règles de personnage et choix), 113 (pacte, multiclassage), 74 (naissance et mort) → 96 (chronologie), 89 (attribuer chaque jet), 100 (rejoindre sans PJ), 102 → 103 (initiative des joueurs), 105 (cœur de résolution) → 110 → 111 (sauvegardes) | Les écrans de Sonnet lisent ces données ; les poser d'abord évite de reprendre les écrans. |
| **2 · La coquille** | 25 → 26 → 28 ; 27 → 29 → 30, 31, 32, 33 ; 20 (dès 25) ; 35 ; 34 ; 36 ; 62 étape 3 | Tout le reste vit dedans : pilule glissante, rail, fenêtres en deux volets, téléphone, accueil. |
| **3 · Entrer et se reconnaître** | 85 → 86 ; 80 → 81 ; 82 → 83 (après 100) ; 87 → 88 | Le premier écran que voit un ami ; court, et tout est décidé. |
| **4 · Les outils du MJ (lot i)** | 46, 55, 61, 54, 56, 44, 45, 43 ; 41 → 42 ; 59 → 60 ; 108 → 57, 109 ; 58 ; 102, 103 → 38 ; 105 → 106 ; 111 → 112 ; 113 → 114 | Les petits outils sans donnée nouvelle d'abord, puis ceux qui attendaient l'étape 1. |
| **5 · La fiche du wiki et ses blocs** | 63 → 64 → 65 à 68 → 69 → 70 à 73 → 75 à 78 ; 79 (après 26 et 33) ; 74 (après 48) | La carte de verre et sa pastille portent tous les blocs. |
| **6 · La création de personnage** | 48 → 49 → 50, 51, 52, 53 (après 115) ; 118, 119 (après 116, 117) | Le plus gros chantier ; il attend les règles en données (47). |
| **7 · Les statistiques du joueur** | 89 → 90 → 91 → 92 | Il leur faut des jets attribués ; les jets d'avant 89 ne comptent pas. |
| **8 · Règles et Chronologie** | 93 → 94 → 95 ; 96 → 97 → 98 → 99 | Les règles s'appuient sur les fenêtres à volets (20) ; la Chronologie sur la pastille (64) et les dates de naissance (74). |
| **À côté, quand on veut** | 13 (attend le texte des manuels de l'auteur) ; vérifications en direct de 1, 2, 4, 5, 12, 17, 18 | Codés ; il ne reste que l'œil de l'auteur. | |
| **Étape 4, avec 105** | 104 (ADR 0041, option B) → 107 | Le joueur qui cible : écritures signées par le serveur. | Après 105. |

**Règle** : un ticket Opus « à concevoir » ne se code pas ; il se conçoit
(ADR), puis il se découpe en tickets prêts. Si Sonnet bute sur une décision
qu'un ticket ne tranche pas, il s'arrête et la note ici.

---

## Où trouver un ticket

Les tickets vivent dans `docs/backlog-v3.1/`, un fichier par partie. **Ne lis que le fichier du ticket en cours** : cette page suffit pour s'orienter.

**Tenir l'index à jour.** Quand un ticket change d'état, change aussi sa ligne
ci-dessous. Un ticket qui passe à ☑ est déplacé de son fichier vers
`termines.md`, rangé par numéro. Un ticket nouveau s'écrit dans le fichier de
sa partie, et une ligne s'ajoute ici.

- [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) — Rugosités d'avant la refonte (V3.1-1 à 18)
- [`02-refonte-parent.md`](backlog-v3.1/02-refonte-parent.md) — La refonte « verre minéral » : ticket parent et décisions transverses (V3.1-19 à 23)
- [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) — Tickets de la refonte « verre minéral » prêts pour Sonnet (4 octobre)
- [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) — Tickets du lot i — les outils du MJ (8 octobre)
- [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) — Tickets de la fiche du wiki et de ses blocs (8 octobre)
- [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) — Tickets du compte, du choix du personnage, des écrans d'entrée et de l'administration (9 octobre)
- [`07-statistiques.md`](backlog-v3.1/07-statistiques.md) — Tickets du volet « Je joue » de l'accueil : les statistiques (9 octobre)
- [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) — Tickets des Règles sur ordinateur et de la Chronologie du monde (9 octobre)
- [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) — Conception du 9 octobre : les tickets Opus découpés
- [`10-dette-technique.md`](backlog-v3.1/10-dette-technique.md) — Dette technique (V3.1-120…)
- [`termines.md`](backlog-v3.1/termines.md) — Tickets terminés (☑)

| Ticket | État | Titre | Fichier |
|---|---|---|---|
| V3.1-1 | ☐ | `REQUIRED_BLOCKS` trop strict sur les sorts sans effet chiffré | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-2 | ☐ | Aucun moyen d'éditer une fiche maison déjà créée | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-3 | ☑ | Les dons à choix (Initié à la magie, etc.) n'ont aucune UI de choix | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-4 | ☐ | Un trait d'espèce qui accorde une maîtrise au choix ne l'accorde jamais | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-5 | ☐ | Le Repos long ne déclenche aucun effet lié aux traits (Inspiration héroïque, etc.) | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-6 | ☑ | Aucun mécanisme générique pour les traits d'espèce à choix | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-7 | ☑ | Une sous-classe n'apporte jamais d'effet mécanique, choix ou pas | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-8 | ☑ | Aucune demande structurée de disponibilités pour la prochaine séance | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-9 | ☑ | Bouton « Prochaine session » mal calibré selon l'écran | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-10 | ☑ | Connexion par identifiant/mot de passe plutôt que lien à retrouver | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-11 | ☑ | Onglet « Solo » visible même avec un MJ humain déjà présent | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-12 | ☐ | « Voir comme » accessible aux MJ de campagne, pas seulement au superadmin | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-13 | ☐ | Sous-classes manquantes pour les classes des 4 joueuses actives | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-14 | ☑ | Aucun moyen pour une joueuse de créer elle-même son PJ sans personnage déjà assigné | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-15 | ☑ | La Gestion de campagne illisible : invitations en haut, une carte par personne | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-16 | ☑ | Le Calendrier réel refait : une grille à bascule, côté MJ comme côté joueuse | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-17 | ☐ | Un catalogue d'interface visuel, et une charte qui y renvoie | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-18 | ☐ | Retirer les émojis de l'interface | [`01-rugosites.md`](backlog-v3.1/01-rugosites.md) |
| V3.1-19 | ☐ | Refonte « verre minéral » (ticket parent) | [`02-refonte-parent.md`](backlog-v3.1/02-refonte-parent.md) |
| V3.1-20 | ☐ | Fenêtres du MJ en deux volets à onglets | [`02-refonte-parent.md`](backlog-v3.1/02-refonte-parent.md) |
| V3.1-21 | ☑ | Cibler et résoudre depuis les boutons de jet | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-22 | ☐ | Salon de groupe et jets dans le chat | [`02-refonte-parent.md`](backlog-v3.1/02-refonte-parent.md) |
| V3.1-23 | ☑ | Ce que les joueurs modifient eux-mêmes (Règles actives) | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-24 | ☐ | Les services de jeu sous la refonte | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-25 | ☐ | La pilule glissante remplace `BinderTabs` | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-26 | ☐ | Fiche d'ordinateur à jauges et commande E | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-27 | ☐ | Rail repliable et dalle Outils (lots a, b) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-28 | ☐ | Tablette : la fiche s'adapte à sa fenêtre (lot f) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-29 | ☐ | Coquille téléphone : barre flottante et feuilles du bas (lot c) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-30 | ☐ | Wiki et Règles sur téléphone : ☰ et consultées récemment | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-31 | ☐ | Éditeur plein écran en accordéon (téléphone) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-32 | ☐ | Fiche sur téléphone : jets, infobulles de règles, sac | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-33 | ☐ | L'outil de dés unique (feuille, panneau, scintillement) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-34 | ☐ | L'outil Table du MJ | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-35 | ☐ | Accueil en tableau de bord (lot h) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-36 | ☐ | Le solo : ailes d'ordinateur et téléphone modèle A (lot d) | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-37 | ☑ | L'initiative vue des joueurs : sécurité, invitation, temps réel | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-38 | ☐ | L'outil Initiative refondu, MJ et joueur | [`03-refonte-sonnet.md`](backlog-v3.1/03-refonte-sonnet.md) |
| V3.1-39 | ☑ | Les sauvegardes demandées à la cible | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-40 | ☑ | Ressources de classe : magie de pacte et recharge partielle | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-41 | ☐ | Bloc-notes : la page partagée devient une entité (données) | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-42 | ☐ | Bloc-notes : le cahier refait, MJ et joueuse | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-43 | ☐ | Livre de sessions : le registre et ses trois ajouts | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-44 | ☐ | Rencontres : l'atelier en trois colonnes | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-45 | ☐ | Générateurs : les tirages à gauche, la fiche à droite | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-46 | ☐ | Probabilités : la matrice, caractéristiques et compétences | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-47 | ☑ | Création : les règles de personnage viennent du ruleset | [`termines.md`](backlog-v3.1/termines.md) |
| V3.1-48 | ☐ | Création : identité, prénom, nom, naissance au calendrier du monde | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-49 | ☐ | Création : le chemin qui se ramifie (structure, aperçu, joueuse) | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-50 | ☐ | Création : Origines, Historique et un seul sélecteur de sorts | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-51 | ☐ | Création : la Classe, et le même écran pour monter de niveau | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-52 | ☐ | Création : les Caractéristiques, la suggestion puis l'échange | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-53 | ☐ | Création : l'Équipement (bande d'équipement, boutique, départ à haut niveau) | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-54 | ☐ | Gestion de campagne au verre minéral, avec « Voir comme » | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-55 | ☐ | Calendrier ingame : l'année d'un coup d'œil | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-56 | ☐ | Calendrier réel au verre minéral, côté MJ et côté joueuse | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-57 | ☐ | Règles actives : le ruleset à gauche, la table à droite | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-58 | ☐ | Personnalisation : le fond d'abord, et pour les joueuses | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-59 | ☐ | Publication : le fond par défaut du wiki (données) | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-60 | ☐ | Publication : les réglages, et ce que voit un visiteur | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-61 | ☐ | Journal historique : par fiche, ou chronologique | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-62 | ☐ | Rapidité : mesurer, puis recâbler | [`04-outils-mj.md`](backlog-v3.1/04-outils-mj.md) |
| V3.1-63 | ☐ | Fiche du wiki sur ordinateur : en-tête, cartes de verre, palette en familles | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-64 | ☐ | La pastille de visibilité au toucher, avec « Annuler » | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-65 | ☐ | Bloc Texte : lettrine, bulle du paragraphe, assistance IA en encart | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-66 | ☐ | Blocs Encadré et Tableau | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-67 | ☐ | Bloc Image : la barre flottante et l'aperçu dans le texte (B) | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-68 | ☐ | Bloc Chronologie : l'axe en bande et une ligne par événement | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-69 | ☐ | Noyau psyché : libellés uniques, bandes des pôles, tension, résumé | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-70 | ☐ | Personnalité (A) et Convictions (même dessin, comparer avec une faction) | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-71 | ☐ | Relation (A) : deux portraits, le résumé, les fils à perle | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-72 | ☐ | Réseau (B) : vignettes, filtres, survol qui allume | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-73 | ☐ | Généalogie (B) : les grands portraits | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-74 | ☐ | Dates de naissance et de mort (données) | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-75 | ☐ | Table aléatoire (A) et le dé animé | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-76 | ☐ | Quête (C) : une ligne, dépliable | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-77 | ☐ | Musique (A) : la platine, les bornes, la durée des fondus | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-78 | ☐ | Carte (C) : la carte et sa liste par couches | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-79 | ☐ | Fiche de créature (A) : la fiche de personnage, pour une créature | [`05-fiche-wiki.md`](backlog-v3.1/05-fiche-wiki.md) |
| V3.1-80 | ☐ | Compte (A) : une page en sections | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-81 | ☐ | L'Apparence du Compte est la Personnalisation C | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-82 | ☐ | Choix du personnage (C2) : le carrousel | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-83 | ☐ | Choix : PJ sans fiche et « Créer mon personnage » | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-84 | ☐ | Identité de l'application : où elle vit (ADR) | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-85 | ☐ | Écran-titre (C) : connexion, création, mot de passe oublié | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-86 | ☐ | La marque partout : rail, onglet, Rejoindre, Réinitialiser | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-87 | ☐ | Administration (B) : le tableau de bord | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-88 | ☐ | Administration › Identité de l'application | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-89 | ☐ | Statistiques : attribuer chaque jet (données, ADR) | [`07-statistiques.md`](backlog-v3.1/07-statistiques.md) |
| V3.1-90 | ☐ | Statistiques : le noyau pur | [`07-statistiques.md`](backlog-v3.1/07-statistiques.md) |
| V3.1-91 | ☐ | Statistiques : le service et le volet de l'accueil | [`07-statistiques.md`](backlog-v3.1/07-statistiques.md) |
| V3.1-92 | ☐ | Administration › Titres des joueurs : l'éditeur | [`07-statistiques.md`](backlog-v3.1/07-statistiques.md) |
| V3.1-93 | ☐ | Règles : le sommaire passe dans la fenêtre | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-94 | ☐ | Règles : la règle au centre, renvois en volet, onglets | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-95 | ☐ | Règles : fenêtre étroite et page du joueur | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-96 | ☐ | Chronologie : portée, événements directs, naissances et morts (données, ADR) | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-97 | ☐ | Chronologie : le noyau pur | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-98 | ☐ | Chronologie : la frise du MJ | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-99 | ☐ | Chronologie : la page des joueurs | [`08-regles-chronologie.md`](backlog-v3.1/08-regles-chronologie.md) |
| V3.1-100 | ☐ | Rejoindre sans choisir de PJ ; le lien qui vise un PJ précis | [`06-compte-entree-admin.md`](backlog-v3.1/06-compte-entree-admin.md) |
| V3.1-101 | ☐ | Initiative : la base et les routes réservées au MJ — codé, migration à appliquer | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-102 | ☐ | Initiative : la vue filtrée des joueurs | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-103 | ☐ | Initiative : les jets d'initiative des joueurs | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-104 | ☐ | Écritures du moteur au nom d'un joueur : changements signés | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-105 | ☐ | Cibler : le cœur commun de résolution | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-106 | ☐ | Cibler côté MJ : outil de dés, Table, Initiative | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-107 | ☐ | Cibler côté joueur | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-108 | ☐ | Droits des joueurs : la base ferme, le serveur règle | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-109 | ☐ | Droits des joueurs : la fiche obéit aux interrupteurs | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-110 | ☐ | Sauvegardes : la restriction de cible (noyau) | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-111 | ☐ | Sauvegardes : la demande et la réponse (données, serveur) | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-112 | ☐ | Sauvegardes : les écrans | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-113 | ☐ | Ressources : pacte, recharge partielle, multiclassage (noyau) | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-114 | ☐ | Ressources : repos et égaliseur | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-115 | ☐ | Règles de personnage : la fiche `character_rules` | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-116 | ☐ | Le mécanisme générique des choix (noyau et résolution) | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-117 | ☐ | La sous-classe résolue et ses choix | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-118 | ☐ | Les choix dans l'assistant de création et de montée de niveau | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-119 | ☐ | Les choix rouverts au repos | [`09-conception-9-octobre.md`](backlog-v3.1/09-conception-9-octobre.md) |
| V3.1-120 | ☐ | Défaire les cycles d'import (services serveur, fiche jouable) | [`10-dette-technique.md`](backlog-v3.1/10-dette-technique.md) |
