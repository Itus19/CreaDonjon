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

**État au 26 octobre** : 63 à 79 sont faits (65 par la session locale de l'auteur, les autres par la session cloud ; détail dans `termines.md`). Restent les deux suites décidées par l'auteur le 26 octobre : **146** (musique, YouTube) et **147** (repaire et défenses). La recharge des capacités de créature en combat est rattachée à **V3.1-129** (`12-regles-jouables.md`).

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
| V3.1-146 | Musique : la position et la durée de la piste YouTube (suite de 77) | S | Sonnet | 77 |
| V3.1-147 | Fiche de créature : le repaire et les défenses (suite de 79) | M | **Opus** puis Sonnet | 79 |

---

### ☐ V3.1-146 — Musique : la position et la durée de la piste YouTube · `S` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet** — décidé par l'auteur le 26 octobre ; le lecteur existe.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la section « Musique » de la planche `OutilsMJ.dc.html` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Reçu de V3.1-77** : la platine du bloc Musique devait montrer la progression, les temps et la durée de chaque piste. Le lecteur partagé (`components/shell/MusicVoice.tsx`, `MusicPlaybackContext.tsx`, `youtubeApi.ts`) ne publie pas la position, et la donnée du bloc n'a pas de durée. **Décidé** : YouTube seulement (comme les bornes et les fondus) ; **rien pour Spotify et SoundCloud** — leur ligne garde sa forme actuelle, sans barre ni durée, sans phrase d'excuse.

**Départ** : `components/blocks/MusicBlockEditor.tsx` (platine et liste), `lib/ui/musique.ts`, le lecteur partagé. **Dépend de** : 77.

**Ce qui est décidé**
- Le lecteur YouTube expose déjà `getCurrentTime()` et `getDuration()` (API IFrame) : le contexte de lecture les publie pour la voix en cours, **relevés pendant la lecture seulement** (un relevé par seconde au plus, arrêté en pause et quand plus rien ne joue — `docs/QUOTAS.md` ne compte pas ce relevé local, mais pas de minuterie qui tourne à vide).
- Platine : la barre de progression et « 0:42 / 3:15 » sous le titre, en tenant compte des bornes (`startSeconds` / `endSeconds` : la barre va du début à la fin choisis).
- Liste : la durée d'une piste YouTube **une fois connue** (après sa première lecture ; jamais un appel au service juste pour la durée), masquée au téléphone comme aujourd'hui.
- Aucun champ ajouté au schéma `music` : la durée est une donnée de lecture, pas du bloc (règle 16).

**Critères d'acceptation**
- [ ] La barre et les temps avancent pendant la lecture d'une piste YouTube et s'arrêtent en pause (test du relevé : rien ne tourne en pause).
- [ ] Une piste bornée « 0:12 → 1:30 » montre une barre de 0:12 à 1:30.
- [ ] Spotify et SoundCloud : aucune barre ni durée, rien d'autre ne change.
- [ ] La page de lecture ne change pas (le ♪ à côté du nom de la fiche reste tel quel).

---

### ☐ V3.1-147 — Fiche de créature : le repaire et les défenses · `M` · sans modèle IA — **prêt**

**Modèle conseillé : Opus (schéma), puis Sonnet (affichage)** — ajout décidé par l'auteur le 26 octobre.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la section « Fiche de créature » de la planche `OutilsMJ.dc.html` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Reçu de V3.1-79** : la planche « Fiche de créature » montre le repaire (« FP 8 · 3 900 PX · Thundertree », lien de fiche) et, dans Maîtrises, les défenses (immunités, résistances). Le schéma `statblock` n'a aucun champ pour eux : la fiche ne les affiche pas.

**Départ** : `src/core/schemas/blocks/statblock.ts`, `components/blocks/MonsterStatblockSheet.tsx` (formulaire `StatblockForm`), `components/blocks/CreatureSheet.tsx`, `lib/ui/creature.ts`. **Dépend de** : 79.

**Ce qui est décidé**
- Schéma `statblock` (données du bloc, pas de migration SQL : les blocs existants restent valides car tous les champs sont facultatifs) :
  - `lair` : une référence de fiche (`zBlockReference`, `kind: "entity"`), facultative ;
  - `defenses` : `{ damage_immunities?, damage_resistances?, damage_vulnerabilities?, condition_immunities? }`, chacun une liste de chaînes (les noms des types de dégâts et des états, tels que le bestiaire les écrit).
  - Mécanique : ces listes ne font **rien** en jeu ici ; leur effet sur les dégâts est le travail de V3.1-137 (« résistances et immunités »), qui les lira.
- Visibilité du repaire : le lien ne se résout côté serveur que si le lecteur voit la fiche citée (règle 5, même chemin que les mentions de l'Encadré, V3.1-66) ; sinon, rien ne s'écrit.
- Saisie : le formulaire « Modifier les valeurs » gagne un sélecteur de fiche pour le repaire et quatre champs de liste (pastilles, « + »), comme les autres listes du formulaire.
- Affichage : l'en-tête ajoute « · <repaire> » (lien de fiche) ; l'onglet Maîtrises ajoute « Défenses » (Immunités, Résistances, Vulnérabilités, États immunisés), une ligne par catégorie présente.

**Critères d'acceptation**
- [ ] Un bloc `statblock` existant, sans les nouveaux champs, s'ouvre et s'enregistre sans erreur (test du schéma).
- [ ] Un repaire caché au lecteur n'est pas envoyé (test serveur, wiki public et coquille joueur).
- [ ] Les défenses s'affichent dans Maîtrises, une ligne par catégorie présente, rien quand la liste est vide.
- [ ] Aucune règle de dégâts ne change (le travail mécanique reste à V3.1-137).

