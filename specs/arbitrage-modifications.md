# Arbitrage — Modifications demandées

**Version :** 1.0 — 12 août 2026
**Établi à partir de :** `Modifications désirées` (21 p.) et du dépôt au commit `8b32c96` (V1-C3 terminé)
**Rôle de ce document :** dire *où* va chaque demande et *pourquoi*. Les demandes complexes sont détaillées dans quatre documents dédiés.

---

## 0. Comment lire

Trois documents nouveaux complètent celui-ci :

| Document | Contenu |
|---|---|
| `specs/fiche-personnage-interactive.md` | Le bloc de fiche jouable, la synchronisation d'inventaire, les boutons d'action |
| `specs/psyche-pnj.md` | Blocs de relation et de personnalité, pôles, historique d'interaction |
| `specs/module-joueur-et-solo.md` | Compagnon PJ, interface du mode solo, écran de combat partagé |

Ce document-ci contient le **triage complet** et les **arbitrages de fond**. C'est celui à lire en premier.

---

## 1. Deux questions de fond, tranchées

### 1.1 « L'épée du roi » — wiki ou règle ?

Vous posez la question directement. Elle est bonne : c'est le point où le modèle unifié se prouve ou s'effondre.

**La réponse tient en une distinction : un *type* ou un *exemplaire*.**

| Nature | Où | Exemple |
|---|---|---|
| Un **type** d'objet, dont il existe des copies | `ruleset_entries` | « épée longue », « potion de soins », « ventouse » |
| Un **exemplaire** unique, qui a une histoire | `entities` + facette mécanique | « Durendal, l'épée du roi Baldric » |

Les deux existent déjà au schéma. Une entité possède une **facette mécanique** (`entity_mechanical_revisions`), qui peut dériver d'une entrée de règle via `based_on_ruleset_entry_id`. Durendal est donc une entité — avec sa fiche, son ancien propriétaire, ses relations — dont la mécanique est « épée longue, plus ces trois propriétés ».

**Et le menu déroulant d'inventaire ?** Il interroge **les deux sources**, dans un seul sélecteur, chaque résultat portant un badge d'origine :

```
Rechercher un objet…
  ⚔ Épée longue            règle · SRD 5.1
  ⚔ Épée longue +1         règle · variante de Valdoria
  ★ Durendal               entité · exemplaire unique
  ⚔ Ventouse               règle · variante de Valdoria
```

C'est déjà prévu : le bloc `inventory` accepte trois natures — référence de règle, référence d'entité, objet en ligne (`specs/wiki-blocs.md` §4.1). Il n'y a rien à réconcilier, seulement un sélecteur à écrire.

**La règle de décision, pour l'humain comme pour l'IA :**

> Si un second exemplaire pourrait exister → **règle**.
> S'il n'y en aura jamais qu'un et qu'il a une histoire → **entité**.

Une ventouse est une règle (dans la variante du monde, par une surcharge `add_entry`). L'épée du roi est une entité. Un « couteau ébréché trouvé sur un cadavre » est un objet en ligne dans l'inventaire, promouvable en entité s'il prend de l'importance.

**Côté IA**, cela donne deux outils distincts, `create_rule_entry` et `create_entity`, et une règle de validation : une proposition qui porte du contenu narratif ou des relations est une entité ; sans quoi c'est une règle. Le modèle ne choisit pas au hasard, la validation tranche.

### 1.2 Importer un PDF ou un JSON de règles achetées

Deux problèmes, un juridique et un technique. Le juridique commande.

**Juridique.** Posséder un PDF ne donne pas le droit de le redistribuer. Un import **dans son propre monde privé** relève de la copie privée et est défendable ; dès que ce contenu devient partageable, publiable, ou intégré à un ruleset public, ce n'est plus le cas. Conséquences non négociables :

- Un ruleset issu d'un import utilisateur est marqué `source: 'user_import'`.
- Il est **exclu du partage** : pas de lien public, pas de campagne avec des membres tiers, pas d'export vers un autre compte.
- Il n'entre **jamais** dans les données d'indexation partagées.
- L'interface l'énonce clairement au moment de l'import, plutôt que de le découvrir plus tard.

**Technique.** Le JSON et le PDF ne sont pas le même problème.

| Format | Faisabilité | Décision |
|---|---|---|
| JSON à notre format documenté | facile | **V2** — l'export existe déjà en miroir |
| JSON d'un autre outil | dépend du format | **assistant de correspondance** — l'utilisateur associe les champs, on n'écrit pas trente convertisseurs |
| PDF | difficile (mise en page, tableaux, colonnes) | **pas d'analyse automatique** |

Pour le PDF, la voie praticable n'est pas l'analyse du fichier mais **le collage assisté** : l'utilisateur colle le texte d'une règle, l'assistant de création de règle (déjà prévu, `specs/regles-couche.md` §5) en propose la structure, l'utilisateur valide dans le bac à sable. Une règle à la fois, sous contrôle. C'est moins spectaculaire qu'un import automatique, et infiniment plus fiable — un analyseur de PDF qui se trompe sur un tableau de progression produit des règles fausses que personne ne remarque.

---

## 2. Ce qui est déjà prévu — précisions intégrées

Neuf demandes précisent des choses déjà spécifiées. Elles enrichissent, elles ne déplacent rien.

| Demande | Déjà prévu dans | Ce que votre document ajoute |
|---|---|---|
| Générateur de rencontres, budget XP, sauvegarde de combat | `outils-mj.md` §4 | export vers l'écran de combat, « Mes combats » |
| Écran de gestion des combats | `outils-mj.md` §5 | panneau latéral des capacités, surbrillance du tour, grisage après le tour, PV publics ou non |
| Générateurs PNJ / noms / taverne / échoppe | `outils-mj.md` §3 | semi-aléatoire, longueurs minimales, jeux de mots optionnels, création de fiche |
| Tables aléatoires | `outils-mj.md` §2 | — |
| Génération de loot | `outils-mj.md` §5 (bloc `loot`) | tirage borné à la liste d'objets du ruleset |
| Blocs de relation et de personnalité | `wiki-blocs.md` partie D | vos sept pôles, l'historique d'interaction — voir `psyche-pnj.md` |
| Créateur de fiches de règles | `regles-couche.md` §5 | import JSON, collage assisté |
| Outil de création de personnage guidé | `wiki-liens-et-personnages.md` §B8 | montée de niveau accompagnée, génération de la fiche wiki |
| Assistant IA rédactionnel | `BACKLOG_V1.md` V1-D3 | insertion au curseur, longueurs, désactivation globale |

---

## 3. Ce qui est nouveau — placement

### 3.1 Correctifs et ajustements — **maintenant**, avant le lot D

Petits, isolés, sans dépendance. Un seul ticket groupé, `V1-C4`.

| Demande | Note |
|---|---|
| Bouton « supprimer » d'un bloc ne fonctionne pas | **bug** — à reproduire par un test avant de corriger |
| Bouton paramètres au-dessus du nom du monde ; centrer le menu | déplacement, pas de logique |
| Bouton d'historique → icône ronde de montre inversée, près du bouton orange | le panneau existe déjà (V1-C3) |
| Panneau de partage → onglet du menu de configuration | retirer l'encart « Valdoria » de l'accueil |
| Bloc de stats affiché **hors** du bloc de personnage | à supprimer, ces infos rejoignent la fiche |
| Écran d'accueil : « Nouvelles aventures » + liste des PJ sous le nom du monde | demande l'étiquette PJ/PNJ ci-dessous |
| Horloge en haut à droite | temps réel ; le chrono partagé attend le module joueur |

**Étiquette PJ/PNJ.** Ne pas créer un `entity_kind` distinct : la distinction n'est pas de nature, elle est **contextuelle**. Un PNJ peut devenir un PJ. La table `campaign_characters` porte déjà `is_pc` — c'est elle qui fait foi, et l'étiquette est dérivée. Hors campagne, aucune étiquette : la notion n'a pas de sens.

### 3.2 Mot de passe sur un lien de partage — **V1-C4**

Ajout mesuré. Le jeton reste le secret principal ; le mot de passe est une seconde barrière optionnelle.

- Colonne `password_hash text` sur `share_links` — **hachage seul**, jamais le mot de passe en clair, même règle que le jeton.
- La page publique demande le mot de passe avant toute lecture, et **le contenu n'est pas récupéré avant validation** — pas de « chargé puis masqué ».
- Limitation de tentatives par jeton, sinon le mot de passe ne protège rien.

### 3.3 Bloc de fiche de personnage jouable — **lot B enrichi, V1-B5**

C'est la plus grosse demande du document et elle mérite le sien : `specs/fiche-personnage-interactive.md`.

Elle arrive après V1-B1 à B4 (le moteur, les blocs, l'état de jeu, la création), qui en sont les fondations. Sans le moteur de fiche dérivée et son empilement de modificateurs, les boutons d'attaque calculeraient des nombres faux.

### 3.4 Aspect « livre » du wiki public — **V2**

Colonne de navigation en sommaire, corps de texte en pleine largeur mesurée, typographie de livre. C'est une **seconde peau** de la coquille, pas une refonte : mêmes composants, jetons différents, largeur de ligne contrainte à 65-75 caractères.

À faire quand le wiki public a du contenu à montrer. Le faire maintenant, c'est habiller trois fiches de test.

### 3.5 Bloc d'association musicale — **V2**, petit

Un lien Spotify ou SoundCloud attaché à une fiche, lecteur intégré. Techniquement trivial. Deux précautions : les intégrations tierces posent des questions de vie privée (cookies, traçage) — le lecteur ne se charge qu'au clic, jamais automatiquement ; et l'URL est validée contre une liste de domaines autorisés, sinon c'est un vecteur d'injection.

### 3.6 Tables de probabilités de réussite — **V2**, excellent rapport valeur/coût

Vous voulez voir, pour chaque PJ, la probabilité de réussir un jet de Charisme ou d'Arcanes à un DD donné.

C'est **une fonction pure sur la fiche dérivée**, presque gratuite : `P(1d20 + mod ≥ DD)`, avec avantage et désavantage. Un tableau PJ × compétence, colonnes DD 10 / 15 / 20, recalculé à chaque changement de fiche. Rien de nouveau en base.

C'est typiquement le genre d'outil qu'aucun concurrent ne propose et qui change la façon de mener une partie. À faire tôt dans la V2.

### 3.7 Assistant de création de session — **V2**

Un bloc-notes structurable, avec des boutons qui ouvrent les générateurs et insèrent leur résultat. Imprimable.

C'est en réalité **une entité de type `session_prep` avec des blocs** — vous avez déjà tout : blocs typés, texte riche, références. Le seul ajout est un bouton d'insertion de générateur dans l'éditeur, et une feuille de style d'impression.

Ne pas construire un second système de documents. C'est le piège ici.

### 3.8 Compagnon joueur et interface solo — **V3**

Voir `specs/module-joueur-et-solo.md`. Deux morceaux distincts qui partagent leur socle :

- **le compagnon PJ** : lien ou QR code, fiche interactive sur téléphone, notes privées, suivi en direct par le MJ ;
- **l'interface solo** : trois colonnes, wiki à gauche, conversation au centre, fiche à droite.

Le compagnon PJ arrive **après** V1-C2 (la RLS fine) — ce qui est fait — mais il introduit une catégorie nouvelle : des utilisateurs qui **écrivent** dans le monde de quelqu'un d'autre. C'est un durcissement de permissions à part entière.

### 3.9 Écriture inclusive — **transversal, à décider maintenant**

Trois niveaux, à ne pas confondre.

**Le genre d'un personnage, en donnée.** Champ sur le bloc `character` :

```
gender: 'feminine' | 'masculine' | 'neutral' | 'unspecified' | { custom: string }
pronouns: string        // 'elle', 'il', 'iel', ou libre
```

`unspecified` n'est pas `neutral` : l'un dit « on ne sait pas », l'autre dit « ni l'un ni l'autre ». Les générateurs proposent les quatre, et les tables de noms ont une colonne neutre.

**Les textes de l'interface.** Recommandation : **la forme épicène plutôt que le point médian.** « L'équipe de jeu » plutôt que « les joueur·se·s », « qui possède ce personnage » plutôt que « le·la propriétaire ». Raison technique, pas idéologique : les lecteurs d'écran lisent le point médian de façon erratique, et c'est une difficulté réelle pour les personnes dyslexiques. L'épicène est inclusif *et* accessible.

Là où l'épicène est impossible, doublet complet (« celles et ceux ») plutôt que point médian. Ce sont des règles de rédaction à inscrire dans `src/i18n/fr.ts`, pas du code.

**Le texte généré par l'IA.** Le genre et les pronoms du personnage entrent dans le contexte, et la consigne demande de les respecter. Une génération qui met « il » sur un personnage `elle` est un bug de prompt, pas une fatalité.

### 3.10 Nouvelle fiche par générateur — **V2**

Le bouton « nouvelle entité » ouvre un choix : fiche vierge, modèle, ou l'un des générateurs. C'est la convergence de `entity_templates` (déjà prévu) et des générateurs. Un seul point d'entrée à la création.

---

## 4. Une remarque sur Dwarf Fortress

Vous citez son modèle de simulation d'émotions comme référence pour les PNJ. L'instinct est bon, et il y a un piège à nommer.

Dwarf Fortress simule des milliers de nains parce que chaque état émotionnel est **quelques octets et un calcul**. Le coût marginal d'un nain de plus est nul.

Ici, chaque mouvement de pôle vient soit d'une action de l'IA — qui coûte des tokens — soit d'une saisie du MJ — qui coûte de l'attention. Une simulation continue serait ruineuse dans les deux cas.

**La transposition qui marche : les pôles ne bougent que sur événement explicite.** Pas de dérive continue, pas de calcul de fond. Un PNJ dont personne ne s'est occupé depuis six séances a exactement les mêmes valeurs qu'à la fin de la sixième. C'est moins vivant qu'un fort de nains, et c'est ce qui rend le système tenable.

Détail dans `specs/psyche-pnj.md`.

---

## 5. Récapitulatif de placement

| Version | Contenu |
|---|---|
| **V1-C4** (nouveau, avant le lot D) | correctifs, coquille, mot de passe de partage, étiquette PJ/PNJ, horloge, genre en donnée |
| **V1-B5** (nouveau, dans le lot B) | fiche de personnage jouable et interactive |
| **V1-D** (inchangé) | assistance IA, avec insertion au curseur et désactivation globale |
| **V2** | outils MJ complets, probabilités, notes de session, wiki « livre », musique, import JSON, création par générateur |
| **V3** | compagnon joueur, interface solo, combat partagé |

---

## 6. Questions tranchées le 12 août

| Question | Réponse retenue |
|---|---|
| Compagnon joueur : application distincte ? | **Non — route responsive dans la même application.** Une base de code, un moteur, un déploiement |
| Les joueurs éditent-ils d'autres fiches ? | **V3 : leur propre fiche. V4 : certaines autres.** Préparé dès la V3 par la fonction `canEditEntity`, un seul point d'autorisation |
| Historique des pôles : que garde-t-on ? | **Tout en base, indéfiniment.** L'IA ne lit que les 5 à 10 dernières entrées **de la paire concernée**, plus un résumé |
| Jeux de mots pop culture | **Tables écrites à la main**, jamais une génération libre — un modèle produirait tôt ou tard un nom de marque |
| Échelle des pôles | **−100 à +100 en base, bandes nommées à l'écran et pour l'IA.** Voir `psyche-pnj.md` §1.5 |

### Ce que l'échelle fine implique

Trois conséquences, détaillées dans `specs/psyche-pnj.md` §1.5 :

1. **Le nombre ne sort jamais du moteur.** `trust: -47` n'est pas actionnable pour un modèle ; « méfiant » l'est. Sept bandes nommées par axe, seuils fixes.
2. **Les événements sont pondérés** : 1-3 pour une broutille, 5-10 pour un fait notable, 15-25 pour un moment marquant, 40+ avec confirmation. C'est le gain principal de l'échelle fine.
3. **Rendements décroissants**, sans quoi tout sature en trente séances : s'éloigner du centre devient de plus en plus difficile, y revenir garde son plein effet. Un PNJ qui vous fait déjà largement confiance ne gagne presque rien à un service de plus ; il perd tout à une trahison.
