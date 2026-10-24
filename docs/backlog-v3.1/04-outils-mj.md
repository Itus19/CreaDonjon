# Backlog V3.1 — Tickets du lot i — les outils du MJ (8 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage du lot i de V3.1-19 : seize outils décidés du 4 au 8 octobre,
planche par planche. Les décisions détaillées vivent dans V3.1-19 (section
« Lot i ») ; chaque ticket ci-dessous les reprend **en entier**, pour qu'on
puisse le coder sans relire la conversation.

**Déjà couverts par des tickets existants** (pas de ticket en double) :
- Initiative → V3.1-37 (données, Opus) puis V3.1-38 (interface) ;
- Table → V3.1-34 ;
- Chat → V3.1-22 (salon, jets, fenêtre B : tout y est) ;
- « Ce que les joueurs modifient eux-mêmes » → V3.1-23 (données et
  serveur) ; son écran est V3.1-57 ;
- « Voir comme » pour le MJ → V3.1-12 (sécurité) ; son entrée de menu est
  V3.1-54.

### Comment lire ces tickets (à faire lire à Sonnet avant chaque ticket)

**Les planches font foi pour l'apparence et les comportements**, le code
fait foi pour les jetons, les composants partagés et la charte. Canevas :
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm, rangée « Lot i — outils
du MJ » (y = 14660). Chaque ticket cite sa planche par son **nom de
fichier** (`Notes-Decide.dc.html`…) : le titre affiché sur le canevas est
tronqué. Une planche est **vivante** : sa logique (dans la balise
`<script type="text/x-dc">` de la planche) montre exactement ce que fait
chaque bouton ; la lire quand un comportement semble ambigu.

**Ce que les planches ne disent pas, et qu'il ne faut pas inventer** :
- Les noms, dates et nombres des planches sont des exemples (Inès, Sakaburin,
  « 14 Brumaire 1492 »…). Les vraies données viennent du serveur.
- Le rail des planches est une copie : **la référence du rail reste
  V3.1-27**, jamais une planche d'outil.
- Les planches dessinent des couleurs en `oklch(...)` en dur : dans le code,
  **uniquement les jetons** (`--accent`, `--edge`, `--panel-*`, `--ink-*`,
  `--danger`, `--success`, `--link-entity`) et les recettes de
  `docs/CHARTE-UI.md`.

**Règles communes au lot i** (en plus de celles des tickets de la refonte,
plus haut : charte et catalogue d'abord, 390 px / 820 px / ordinateur,
quatre modes et contraste élevé, mouvement réduit, rien de caché envoyé au
client, ce qui n'est pas dans le ticket n'est pas fait) :
1. **MJ en fenêtre, joueuse en page pleine.** Un outil du MJ s'ouvre dans
   les fenêtres à volets (V3.1-20) avec le rail, « MJ » allumé ; une
   joueuse n'a jamais de fenêtre : son écran est une page pleine dans sa
   coquille (rail du joueur sur ordinateur et tablette, barre du joueur au
   téléphone).
2. **Tablette = la fenêtre étroite.** La disposition de tablette se
   déclenche sur la **largeur de la fenêtre** (requête de conteneur CSS,
   comme V3.1-28), pas sur `window.innerWidth` : un volet partagé sur
   ordinateur prend la même disposition.
3. **Téléphone** : Outils › <outil> (grille de V3.1-29), feuilles du bas
   pour tout ce qui s'ouvre (composant unique de V3.1-29).
4. **Ascenseurs** : la règle globale de `app/globals.css` (6 px, piste
   transparente, curseur `--edge`, `--edge-strong` au survol). Aucun
   ascenseur natif, aucun style d'ascenseur local.
5. **Boutons** : les quatre recettes de la charte (plein accent,
   secondaire, fantôme accent, danger fantôme) ; interrupteurs et pilules
   des composants partagés (`Checkbox`/interrupteur, pilule de V3.1-25).
   Icônes au trait, aucun émoji (charte §10).
6. **Rapidité (voir V3.1-62)** : la première vue d'un outil arrive **avec la
   page ou la fenêtre** (données lues côté serveur et passées en props), pas
   par un `fetch` dans un `useEffect` après l'affichage ; une action met
   l'écran à jour **aussitôt** (état local optimiste, remis en place si le
   serveur refuse) plutôt que par `router.refresh()` ; jamais
   `window.location.reload()` ; requêtes indépendantes en `Promise.all`,
   jamais une requête par ligne (N+1).
7. **Libellés en français dans `messages/fr.json`** (ou `src/i18n/fr.ts`
   selon le fichier qui porte déjà ceux de l'outil), identifiants en
   anglais.
8. Fin : `npm run typecheck && npm run lint && npm run test`, et la planche
   du catalogue (`docs/catalogue/`) de chaque élément nouveau ou modifié.

**Choisir le modèle** : chaque ticket porte sa ligne « Modèle conseillé ».
**Opus** quand il faut décider ou toucher à la sécurité — migration, RLS,
ADR, structure de données de règles, état partagé délicat (41, 47, 49, 59,
62 étapes 1-2) ; **Sonnet** quand tout est décidé et esquissé et qu'il
s'agit de le construire fidèlement (les autres). Si Sonnet bute sur une
décision que le ticket ne tranche pas, il s'arrête et la note ici : il ne
la prend pas seul.

**Ordre conseillé** : 62 (mesures) d'abord, puis les petits outils sans
donnée nouvelle (46, 55, 61, 54, 56, 44, 45, 43), puis les tickets à
données (41 → 42, 59 → 60, 23 → 57, 58), enfin la Création (47 → 48 → 49 →
50, 51, 52, 53).

| Ticket | Outil | Taille | Modèle | Dépend de |
|---|---|---|---|---|
| V3.1-41 | Bloc-notes : la page partagée (données) | M | Opus | — |
| V3.1-42 | Bloc-notes : le cahier refait | L | Sonnet | 41, 20, 25, 29 |
| V3.1-43 | Livre de sessions : le registre | M | Sonnet | 20, 29 ; « Relancer » : 22 |
| V3.1-44 | Rencontres : l'atelier en trois colonnes | M | Sonnet | 20, 29 |
| V3.1-45 | Générateurs : tirages et fiche | M | Sonnet | 20, 25, 29 |
| V3.1-46 | Probabilités : la matrice | M | Sonnet | 20, 29 |
| V3.1-47 | Création : les règles de personnage en données | L | Opus | V3.1-3, 6, 7 (conception) |
| V3.1-48 | Création : identité, prénom, nom, naissance | M | Sonnet | — |
| V3.1-49 | Création : le chemin qui se ramifie | L | **Opus** | 47, 48, 25, 26, 29 |
| V3.1-50 | Création : Origines, Historique, Sorts | L | Sonnet | 49 |
| V3.1-51 | Création : Classe et Monter de niveau | L | Sonnet (Opus si 49 n'a pas fixé l'écriture « avant → après ») | 47, 49 |
| V3.1-52 | Création : Caractéristiques | M | Sonnet | 47, 49 |
| V3.1-53 | Création : Équipement | L | Sonnet | 24, 47, 49 |
| V3.1-54 | Gestion de campagne au verre minéral | S | Sonnet | 20, 29 ; « Voir comme » : 12 |
| V3.1-55 | Calendrier ingame : l'année d'un coup d'œil | M | Sonnet | 20, 29 |
| V3.1-56 | Calendrier réel au verre minéral | M | Sonnet | 20, 27, 29 |
| V3.1-57 | Règles actives : deux volets | M | Sonnet | 23, 26 |
| V3.1-58 | Personnalisation : le fond d'abord, et pour les joueuses | M | Sonnet | 27, 35 |
| V3.1-59 | Publication : le fond par défaut du wiki (données) | M | Opus | — |
| V3.1-60 | Publication : réglages et ce que voit un visiteur | M | Sonnet | 58, 59 |
| V3.1-61 | Journal historique : par fiche ou chronologique | M | Sonnet | 20, 29 |
| V3.1-62 | Rapidité : mesurer, puis recâbler | M | Opus puis Sonnet | — |
| V3.1-143 | Journal : « supprimée … par X », et les fiches supprimées dans la fenêtre | S | **Opus** (migration) | 61 |

---

### ☐ V3.1-49 — Création : le chemin qui se ramifie (structure, aperçu, joueuse) · `L` · sans modèle IA — **prêt après 47 et 48**

**Modèle conseillé : Opus** — l'écran est décidé, mais le cœur est un état de choix en cascade (un choix naît de sa source, disparaît si elle change, attend un autre choix) partagé par toutes les étapes, l'aperçu en direct et la création finale ; une erreur y casse les quatre tickets suivants. **Sonnet** pour 50 à 53, qui se branchent dessus.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Creation-Decide.dc.html` (MJ, joueuse, tablette, téléphone).
**Départ** : `components/blocks/CharacterCreatorWizard.tsx` et
`components/blocks/characterCreatorSteps/*`,
`app/m/[worldSlug]/joueur/nouveau-personnage/page.tsx`, cas
`creation-personnage`. **Dépend de** : 47, 48, 25, 26 (fiche), 29.

**Ce qui est décidé**
- **Étapes à gauche** : Identité, Espèce, Classe, Caractéristiques, Points
  de vie (seulement au-delà du niveau 1), Historique, Équipement, Sorts
  (seulement pour un incantateur), Aperçu. **L'onglet Compétences
  disparaît** ; ses contenus sont redistribués :
  - chaque choix de compétence et de maîtrise d'armes vit sous l'étape qui
    l'accorde ;
  - **les langues (le Commun, plus deux au choix) vivent sous Identité**
    (en 2024 elles appartiennent au personnage ; le code les rattache déjà
    à « Personnage », `resolvedRuleset.ts`) ; une langue donnée par une
    classe (Roublard : Argot des voleurs acquis, plus une au choix) sous
    Classe ; une langue fixe (druidique) affichée comme acquise ; une espèce
    ou un historique maison qui en donne les fait naître sous son étape ;
  - la grille des dix-huit compétences et de leurs modificateurs passe dans
    l'aperçu.
- **Sous-étapes** : sous chaque étape, les choix qu'elle fait naître
  (point doré à faire, vert fait ; « n à faire » sur l'étape). Un choix naît
  là où sa source est choisie et **disparaît si elle change**. Exemples :
  lignage ou legs et sa caractéristique d'incantation, Sens aiguisés,
  Compétent, Polyvalent → don → sorts en cascade, taille (Espèce) ; Ordre
  divin, Style de combat, compétences de classe, Expertise (qui attend les
  compétences), maîtrise d'armes, équipement A/B, sous-classe à son niveau
  (Classe) ; +2/+1 ou +1/+1/+1, don d'origine et ses choix, jeu ou outil,
  équipement (Historique) ; sorts mineurs et préparés (Sorts).
- L'écran au centre ; **Précédent / Suivant** parcourent étapes et
  sous-étapes dans l'ordre ; l'**aperçu en direct à droite** (le vrai moteur
  de la fiche).
- **Étape Aperçu** : la fiche décidée elle-même (V3.1-26, 28, 32 ; même
  composant, comme `PreviewStep.tsx` aujourd'hui). Actions de jeu (jets,
  repos, PV) inactives, inventaire modifiable. Les choix encore ouverts
  (un toucher ramène à leur sous-étape) et « Créer le personnage ». **Un
  choix ouvert n'empêche pas de créer** (la fiche le rappellera).
- **MJ** : en fenêtre. **Joueuse** : en page pleine, **mêmes droits que le
  MJ** — niveau de départ et multiclassage (décidé le 6 octobre) :
  `playerRestricted` (dans `CharacterCreatorWizard`) et `hideAddClass`
  (dans `LevelClassesStep`) disparaissent.
- **Tablette** : sans la colonne d'aperçu (l'étape Aperçu reste).
  **Téléphone** : une étape par écran, barre de progression.

**Critères d'acceptation**
- [ ] Humain → Polyvalent → Initié à la magie → liste de sorts : la cascade naît, et disparaît si on change d'espèce.
- [ ] Roublard : l'Expertise attend les compétences ; l'Argot des voleurs est acquis sous Classe.
- [ ] Plus d'étape Compétences ; les langues sous Identité.
- [ ] Une joueuse crée un personnage de niveau 5 multiclassé.
- [ ] Un personnage avec des choix ouverts se crée, et la fiche les signale.

---

### ☐ V3.1-50 — Création : Origines, Historique et un seul sélecteur de sorts · `L` · sans modèle IA — **prêt après 49**

**Modèle conseillé : Sonnet** — planches définitives.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : `Origines-Decide.dc.html`, `Historique-Decide.dc.html`.
**Départ** : `SpeciesStep.tsx`, `BackgroundStep.tsx`,
`SpellSelectionStep.tsx`, `RemainingChoicesStep.tsx`. **Dépend de** : 49.

**Ce qui est décidé**
- **Espèce et Historique** : les options en petites cartes (trois par
  ligne, deux sur tablette et téléphone), dessous la fiche de la sélection —
  traits en une ligne chacun, « Ce qui en naît » en pastilles qui mènent
  aux sous-étapes.
- **Lignage, legs, lignage gnomique** : tableau comparatif, une colonne par
  option, niveaux 1, 3 et 5 (une carte par option au téléphone).
- **Valeurs de caractéristique de l'historique** : jetons « +2 et +1 » ou
  « +1 à chacune », le total s'affiche.
- **Choix expliqués** : la caractéristique d'incantation dit à quoi elle
  sert (DD et attaque des sorts **du trait**, rien d'autre) et chaque option
  montre son effet chiffré pour ce personnage (« mod. +2 → DD 12,
  attaque +4 »), en signalant celle de la classe ou la meilleure. Sens
  aiguisés : ce que couvre chaque compétence, le total qu'elle donnerait, et
  « déjà maîtrisée (Acolyte) : ce choix ne donnerait rien de plus ». Les
  chiffres viennent du moteur, jamais d'un calcul dans le composant.
- **Historique, le don** : une seule sous-étape « Don : Initié à la magie
  (Clerc) · n/3 » ; son écran regroupe les choix du don en sections
  (caractéristique d'incantation avec son effet chiffré, deux sorts
  mineurs, un sort de niveau 1), chacune avec son compte ; à côté, la fiche
  du sort touché (école, temps, portée, durée, effet).
- **Un seul sélecteur de sorts** (cartes + fiche du sort) : celui de l'étape
  Sorts et de **tout** choix de sorts né d'un trait, d'un don ou d'une
  sous-classe. L'étape Sorts : budget de la classe (sorts mineurs, sorts
  préparés) lu dans la progression d'incantation du ruleset.
- **Équipement de l'historique A ou B** : deux cartes, la liste des objets de
  A face aux pièces de B ; l'outil à choisir (le jeu du Soldat) en cartes.
- Tablette et téléphone : la fiche du sort passe sous les sections ; les
  cartes d'équipement s'empilent.

**Critères d'acceptation**
- [ ] Un seul composant de sélection de sorts, utilisé par l'étape Sorts et par Initié à la magie (aucun doublon).
- [ ] Sens aiguisés sur une compétence déjà maîtrisée affiche « ce choix ne donnerait rien de plus ».
- [ ] L'effet chiffré de la caractéristique d'incantation suit les valeurs de caractéristiques en direct.
- [ ] Maîtrises sans doublon (« Lance » en double), toutes en français (outil de l'Acolyte), y compris la maîtrise d'outil du Soldat (vu par la vérification du 11 octobre).

---

### ☐ V3.1-51 — Création : la Classe, et le même écran pour monter de niveau · `L` · sans modèle IA — **prêt après 47 et 49**

**Modèle conseillé : Sonnet** — planche définitive ; règles fournies par 47.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Classe-Decide.dc.html`. **Départ** : `LevelClassesStep.tsx`,
`HpRollStep.tsx`, `CreationHpRollStep.tsx`, `AsiStep.tsx`,
`components/blocks/LevelUpWizard.tsx` (remplacé). **Dépend de** : 47, 49.

**Ce qui est décidé**
- **En tête, les classes du personnage en emplacements**, « + Ajouter une
  classe » avec le contrôle des prérequis de 47 (le MJ peut passer outre).
  L'emplacement choisi ouvre sa grille et sa fiche ; le niveau de cette
  classe se règle par − / + ou d'un toucher (1, 5, 10, 15, plafond) ; le
  niveau de personnage, somme des classes, ne dépasse pas le plafond du
  ruleset.
- **La progression porte les choix** : tous les niveaux de la classe, une
  ligne chacun (acquis en vert, niveau atteint en doré, la suite estompée
  avec ce qui viendra). Chaque choix d'un niveau atteint (sous-classe,
  améliorations, don épique, Expertise…) est une **pastille sur sa ligne**
  qui ouvre le choix. L'étape Classe, à gauche, ne liste que les choix du
  niveau 1, plus « Choix de niveau · n à faire ».
- **Points de vie** : une ligne par niveau au-delà du premier (classe, dé,
  moyenne ou jet du serveur, à basculer), « Moyenne pour tous » ou
  « Lancer tous ». Les jets sont faits par le serveur (règle 8).
- **Monter de niveau** : le même écran, ouvert par « monter de niveau ▸ » sur
  la fiche. On choisit la classe qui gagne le niveau (existante ou
  nouvelle) et combien de niveaux (plusieurs d'un coup) ; les niveaux
  acquis sont verrouillés, les nouveaux en doré ; les étapes se réduisent à
  ce qui change (points de vie, choix des nouveaux niveaux, sorts), puis un
  aperçu avant → après. **Remplace `LevelUpWizard.tsx`** (supprimé).
- **Joueuse** : niveau de départ et multiclassage libres (voir 49).

**Critères d'acceptation**
- [ ] Clerc 3 / Guerrier 2 : deux emplacements, niveau de personnage 5, choix de chaque ligne atteinte en pastilles.
- [ ] Monter de 3 niveaux d'un coup en ajoutant une classe ; aperçu avant → après ; une seule écriture.
- [ ] `LevelUpWizard.tsx` n'existe plus ; aucun import restant.
- [ ] « Lancer tous » : les valeurs viennent du serveur (test de la route : le client n'envoie aucun résultat).

---

### ☐ V3.1-52 — Création : les Caractéristiques, la suggestion puis l'échange · `M` · sans modèle IA — **prêt après 47 et 49**

**Modèle conseillé : Sonnet** — planche définitive ; constantes déplacées par 47.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Carac-Decide.dc.html`. **Départ** : `AbilityScoreStep.tsx`,
`src/core/rules/abilityGeneration.ts`. **Dépend de** : 47, 49.

**Ce qui est décidé**
- **Tableau standard** : « Répartir pour un clerc » place les valeurs selon
  la classe (ordre lu dans le ruleset, 47) ; puis on **touche deux cases
  pour échanger** leurs valeurs.
- **Six grandes cases** : total, modificateur, et d'où vient le total (base,
  historique, améliorations).
- **Achat de points** : − / + par case, jauge du budget qui **refuse** de
  dépasser (budget et coûts lus du ruleset).
- **Tirage** : fait par le serveur (formule du ruleset), puis suggestion et
  échange.
- Le bonus d'historique se répartit dans **sa** sous-étape (50), les
  améliorations de niveau dans la leur (51) : cette étape les montre, ne
  les règle pas.

**Critères d'acceptation**
- [ ] Suggestion puis échange de deux cases ; les totaux suivent.
- [ ] Achat de points : impossible de dépasser le budget (le + se grise).
- [ ] Tirage : aucun résultat calculé côté client (test de la route).

---

### ☐ V3.1-53 — Création : l'Équipement (bande d'équipement, boutique, départ à haut niveau) · `L` · sans modèle IA — **prêt après 24, 47 et 49**

**Modèle conseillé : Sonnet** — planche définitive, très détaillée ; services de 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Equipement-Decide.dc.html`. **Départ** : étape
« Équipement » de `CharacterCreatorWizard.tsx`, services `changeCurrency` et
`setItemEquipped` (V3.1-24). **Dépend de** : 24, 47, 49.

**Ce qui est décidé**
- **En tête** : bourse et charge — l'or des options de départ (A/B de la
  classe et de l'historique), dépensé aux prix du ruleset ; charge selon la
  Force (multiplicateur du ruleset, 47).
- **Trois tuiles sans boutons** : Armure, Main principale, Main secondaire,
  avec la fiche chiffrée de l'objet porté ; la CA et l'attaque qui en
  découlent viennent du moteur (règle 16). Au remplacement, la tuile
  **scintille comme les dés** (nom et fiche défilent flous parmi les objets
  du même type, puis se figent) et la CA **compte** jusqu'à sa nouvelle
  valeur — même animation que l'outil de dés (V3.1-33) ; mouvement réduit :
  changement direct.
- **La bande d'équipement** : à gauche de chaque objet qui se porte, une
  bande-bouton sur toute la hauteur de la ligne, avec **le symbole du
  type** (armure, arme = petite épée au trait — lame, garde, poignée,
  pommeau —, bouclier), éteinte rangé, dorée porté. Allumer un objet éteint
  éteint **en fondu** celui qui occupait l'emplacement, qui revient au sac.
  Un objet qui ne se porte pas garde la place de la bande, vide. Icônes
  dessinées au trait (aucune bibliothèque, charte §10).
- **Inventaire par ordre alphabétique**, objets portés compris.
- **Colonnes communes à l'inventaire et à la boutique** : bande (ou symbole
  du type en boutique), nom et fiche, **poids, prix**, action (« rendre »,
  « acheter ») — poids et prix exactement au même endroit, pour **toutes**
  les entrées.
- **Rendre ou vendre** : pendant la création, × **rend** l'objet et le
  **rembourse en entier** ; une fois en jeu, sur la fiche, × **vend** à la
  moitié du prix (ratio du ruleset, 47) — ce ticket fait la création ; la
  vente sur la fiche suit le même composant.
- **Boutique cherchable** : une zone de recherche (nom, type, propriété —
  « épée », « armure », « perforants ») ; **sous chaque objet, sa fiche
  chiffrée** (dés de dégâts et propriétés, botte d'arme, CA et limite de
  Dextérité, Force requise, discrétion, poids). « Acheter » grisé si la
  bourse ne suffit pas.
- **Départ à haut niveau** : d'après la table du ruleset (47), au-delà du
  niveau 4 de l'or en plus (somme fixe + jet du serveur) et, aux niveaux
  élevés, des objets magiques à choisir — une sous-étape d'Équipement.
- **Tablette et téléphone** : la ligne passe sur deux rangées (« rendre » ou
  « acheter » dessous), **la bande couvre toute la hauteur de la carte**,
  marge à droite pour que le prix ne touche pas le bord ; les tuiles sur
  deux colonnes.

**Critères d'acceptation**
- [ ] Acheter puis rendre : la bourse revient exactement à sa valeur.
- [ ] Allumer une armure éteint l'ancienne en fondu ; la tuile scintille ; la CA compte jusqu'à la valeur du moteur.
- [ ] Recherche « perforants » : seuls les objets qui ont cette propriété.
- [ ] Poids et prix alignés en colonnes à 390 px, 820 px et sur ordinateur.
- [ ] Mouvement réduit : aucune animation.

---

