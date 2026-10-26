# Backlog V3.1 — Tickets de la fiche du wiki et de ses blocs (8 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage des décisions du 8 octobre : la fiche du wiki sur ordinateur, puis
les trois familles de blocs — Récit, Psyché et liens, Outils de jeu (dont la
Fiche de créature). Les décisions détaillées vivent dans V3.1-19 (sections
« la fiche du wiki sur ordinateur » et « Les blocs de la fiche du wiki — 1,
2, 3 ») ; chaque ticket ci-dessous les reprend **en entier**, pour qu'on
puisse le coder sans relire la conversation.

**Déjà couverts ailleurs** (pas de ticket en double) : l'éditeur de la fiche
sur téléphone (V3.1-30, V3.1-31) ; les blocs de personnage (Personnage,
Inventaire, Incantation, Ressources : V3.1-26, 28, 32) ; le Générateur
(outil du MJ, V3.1-45) ; la naissance d'un personnage au calendrier du monde
(V3.1-48) ; « Voir comme » côté serveur (V3.1-12).

### Comment lire ces tickets (à faire lire à Sonnet avant chaque ticket)

Tout ce qui est écrit dans « Comment lire ces tickets » du lot i (plus haut)
vaut ici à l'identique : planches qui font foi pour l'apparence et les
comportements, exemples qui ne sont que des exemples, jetons et recettes de
la charte au lieu des couleurs en dur des planches, règles communes 1 à 8
(MJ en fenêtre, tablette = fenêtre étroite par requête de conteneur,
téléphone en feuilles du bas, ascenseurs globaux, quatre recettes de
boutons, rapidité, libellés en français dans les fichiers de libellés,
typecheck + lint + test + planche du catalogue). En plus :

**Les planches** sont sur le canevas
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm, rangée « fiche du wiki »
(y = 27000 et dessous) :

| Fichier de planche | Contenu |
|---|---|
| `Wiki-Fiche-Decide.dc.html` | La fiche du wiki sur ordinateur (en-tête, cartes de verre, palette) |
| `Blocs-Recit-Decide.dc.html` | Texte, Encadré, Image (B), Tableau, Chronologie ; pastille de visibilité au toucher |
| `Psy-Decide.dc.html` | Personnalité, Convictions, Réseau, Généalogie, Relation — ordinateur et téléphone |
| `Outils-Decide.dc.html` | Table aléatoire, Quête, Musique, Carte — ordinateur et téléphone |
| `Creature-Decide.dc.html` | Fiche de créature — ordinateur et téléphone |

Une planche est **vivante** : sa logique (balise `<script type="text/x-dc">`)
montre exactement ce que fait chaque bouton ; la lire quand un comportement
semble ambigu. Les planches sont des maquettes : les données (Sildar,
Gundren, Venomfang, « 7 oct. 1492 »…) sont des exemples, les tirages et
jets y sont simulés par `Math.random` — **dans l'application, seul le
serveur tire et lance** (règle 8).

**Règles propres à ces tickets**
1. **Une carte de verre par bloc, partout** : chaque bloc garde l'en-tête
   de carte de V3.1-63 (⠿, ▾, titre, type, « Enregistré », pastille de
   visibilité, ⋮). Les tickets de blocs ne décrivent que **l'intérieur** de
   la carte.
2. **Lecture et édition dans le même dessin.** Le wiki public et la page du
   joueur affichent le même intérieur, sans les commandes d'édition
   (`canEditEntity`, règle 22) ; ce qui est caché à un lecteur ne lui est
   jamais envoyé (règle 5) — pas de champ masqué en CSS.
3. **Bandes nommées, jamais le nombre** (specs/psyche-pnj.md §1.5) : un
   lecteur voit « Altruisme fort », jamais « 45 » ; la valeur exacte
   n'apparaît qu'au survol, pour le MJ.
4. **Psyché : les valeurs bougent par le journal ou par le réglage du MJ,
   rien d'autre.** Glisser un curseur est le réglage fin du MJ (comme
   aujourd'hui) ; un souvenir passe par les routes `personality-event` /
   `attitude_events` existantes (ADR 0013).
5. **Tests d'abord pour le noyau** (`src/core/**`) : chaque fonction pure
   nouvelle a ses tests avant son code.

**Choisir le modèle** : Opus pour 74 (donnée nouvelle, ADR), Sonnet pour
tout le reste. Si Sonnet bute sur une décision que le ticket ne tranche pas,
il s'arrête et la note ici.

**Ordre conseillé** : 63 → 64 (tout le reste s'appuie sur la carte de verre
et sa pastille) ; puis Récit (65 à 68) ; puis 69 (noyau psyché) → 70, 71,
72, 73 ; puis Outils de jeu (75 à 78) ; 79 après V3.1-26 et 33 ; 74 après
V3.1-48.

| Ticket | Contenu | Taille | Modèle | Dépend de |
|---|---|---|---|---|
| V3.1-63 | Fiche du wiki sur ordinateur : en-tête, cartes de verre, palette en familles | L | Sonnet | 20, 25 |
| V3.1-64 | La pastille de visibilité au toucher, avec « Annuler » | S | Sonnet | 63 |
| V3.1-65 | Bloc Texte : lettrine, bulle du paragraphe, assistance IA en encart | M | Sonnet | 63 |
| V3.1-66 | Blocs Encadré et Tableau | M | Sonnet | 63 |
| V3.1-67 | Bloc Image : la barre flottante et l'aperçu dans le texte (B) | M | Sonnet | 63 |
| V3.1-68 | Bloc Chronologie : l'axe en bande et une ligne par événement | M | Sonnet | 63, 64 |
| V3.1-69 | Noyau psyché : libellés uniques, bandes des pôles, tension, résumé | S | Sonnet | — |
| V3.1-70 | Personnalité (A) et Convictions (même dessin, comparer avec une faction) | L | Sonnet | 63, 69 |
| V3.1-71 | Relation (A) : deux portraits, le résumé, les fils à perle | L | Sonnet | 63, 69 |
| V3.1-72 | Réseau (B) : vignettes, filtres, survol qui allume | M | Sonnet | 63 |
| V3.1-73 | Généalogie (B) : les grands portraits | M | Sonnet | 63 ; dates : 74 |
| V3.1-74 | Dates de naissance et de mort (données) | M | **Opus** | 48 |
| V3.1-75 | Table aléatoire (A) et le dé animé | M | Sonnet | 63, 33 |
| V3.1-76 | Quête (C) : une ligne, dépliable | S | Sonnet | 63 |
| V3.1-77 | Musique (A) : la platine, les bornes, la durée des fondus | M | Sonnet | 63 |
| V3.1-78 | Carte (C) : la carte et sa liste par couches | M | Sonnet | 63, 64 ; « Voir comme » : 12 |
| V3.1-79 | Fiche de créature (A) : la fiche de personnage, pour une créature | L | Sonnet | 25, 26, 33, 63 |

---

