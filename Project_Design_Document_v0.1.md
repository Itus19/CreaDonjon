# Project Design Document (PDD)
## Plateforme de création, gestion, simulation et exploration de mondes narratifs

**Version :** 0.1  
**Statut :** Pré-production / brainstorming structuré  
**Document :** Source de vérité fonctionnelle du projet  
**Dernière mise à jour :** 27 juillet 2026

---

## Table des matières

1. [Vision du projet](#1-vision-du-projet)
2. [Objectifs](#2-objectifs)
3. [Principes non négociables](#3-principes-non-négociables)
4. [Utilisateurs et modes d'utilisation](#4-utilisateurs-et-modes-dutilisation)
5. [Architecture fonctionnelle générale](#5-architecture-fonctionnelle-générale)
6. [Wiki vivant et base de connaissances](#6-wiki-vivant-et-base-de-connaissances)
7. [Architecture modulaire des fiches](#7-architecture-modulaire-des-fiches)
8. [Moteur de règles](#8-moteur-de-règles)
9. [Versionnage et héritage des règles](#9-versionnage-et-héritage-des-règles)
10. [Assistant IA](#10-assistant-ia)
11. [Mémoire, contexte et gestion des tokens](#11-mémoire-contexte-et-gestion-des-tokens)
12. [Mode solo](#12-mode-solo)
13. [Simulation procédurale du monde](#13-simulation-procédurale-du-monde)
14. [Cartographie](#14-cartographie)
15. [Campagnes, parties et sauvegardes](#15-campagnes-parties-et-sauvegardes)
16. [Joueurs, MJ, permissions et collaboration](#16-joueurs-mj-permissions-et-collaboration)
17. [Génération de contenu](#17-génération-de-contenu)
18. [Immersion audiovisuelle](#18-immersion-audiovisuelle)
19. [Recherche, navigation et interconnexion](#19-recherche-navigation-et-interconnexion)
20. [Architecture technique et contraintes de développement](#20-architecture-technique-et-contraintes-de-développement)
21. [Liberté des composants et commercialisation](#21-liberté-des-composants-et-commercialisation)
22. [Feuille de route indicative](#22-feuille-de-route-indicative)
23. [Décisions validées](#23-décisions-validées)
24. [Questions ouvertes](#24-questions-ouvertes)
25. [Idées futures](#25-idées-futures)

---

# 1. Vision du projet

## Promesse centrale

> **Une application unique pour créer, simuler et explorer des mondes de jeu, avec les règles, le lore, le wiki, les outils de MJ, les outils de joueur et le jeu solo centralisés au même endroit.**

L'application est pensée comme une **plateforme de création et de simulation de mondes narratifs assistée par IA**.

D&D constitue un premier cas d'usage important, mais l'architecture ne doit pas être limitée à D&D ni même aux TTRPG.

L'objectif est de permettre à une même personne de :

- créer un monde ;
- écrire et organiser son lore ;
- gérer un wiki vivant ;
- choisir ou créer un système de règles ;
- préparer et jouer une campagne ;
- jouer en tant que joueur dans une campagne créée par quelqu'un d'autre ;
- jouer en solo avec l'application comme maître du jeu ;
- utiliser l'IA comme assistant de création et de jeu ;
- faire évoluer un monde au fil du temps ;
- conserver toutes les informations nécessaires dans une base structurée et interconnectée.

L'utilisateur ne devrait idéalement **pas avoir besoin de quitter l'application pour aller chercher un autre outil** pour les fonctions principales de création et de jeu.

## Inspirations

Si-dessous voici quelques sites et applications qui ont inspiré ce projet afin d'avoir une idée plus précise des fonctionnalités désirées et de leur applications : 

- https://vvd.world -> Pour son wiki avec liens automatiques, ses fiches, ses blocs et son visuel UI
- https://dd2024.fr -> Pour l'aspect compagnon mj avec son créateur de personnge, ses fiches de règles, ses génrateurs aléatoires (nom, rencontres, pnj, etc...)
- https://alchemyrpg.com -> Pour son visuel absolument incroyable, pour son coté ttrpg poussé et agréable.
- Dwarf Fortress (jeu) -> Pour le côté simulation du monde, des histoires, des réactions des nains, des souvenirs des nains, etc...
- Donjons et Dragons -> Nous allons utiliser ses moteurs de jeux 2014 et 2024 comme base dans un premier temps.

---

# 2. Objectifs

## Objectifs principaux

1. Centraliser les outils nécessaires à la création et au jeu.
2. Faire du wiki la base de connaissances centrale du monde.
3. Séparer les données du monde, les règles et leur présentation.
4. Permettre à l'IA de consulter précisément les données dont elle a besoin.
5. Minimiser le contexte envoyé aux modèles d'IA afin de réduire l'utilisation de tokens.
6. Permettre au MJ de modifier librement les contenus générés.
7. Permettre la création de systèmes de règles personnalisés.
8. Permettre le jeu solo avec un MJ IA.
9. Générer des mondes cohérents et organiques.
10. Concevoir une architecture suffisamment modulaire pour évoluer progressivement.

## Objectifs secondaires

- Permettre plusieurs MJ sur un même monde à terme.
- Permettre le partage de mondes.
- Permettre la réutilisation des mondes générés grâce aux seeds.
- Permettre l'import/export de données.
- Rendre les composants remplaçables et aussi libres que possible.
- Préparer une éventuelle commercialisation future.

---

# 3. Principes non négociables

Ces principes doivent guider les décisions techniques et fonctionnelles.

### 3.1 L'IA assiste, elle ne confisque pas le contrôle

L'IA peut :

- proposer ;
- générer ;
- compléter ;
- transformer ;
- expliquer ;
- rechercher ;
- automatiser certaines opérations.

Mais le contenu généré doit rester **éditable par l'utilisateur**, particulièrement pour le MJ.

### 3.2 Le wiki est une source de vérité

Les informations persistantes du monde doivent être stockées dans les données du projet.

L'IA ne doit pas être utilisée comme base de données implicite.

### 3.3 Une information est définie une seule fois

Lorsqu'une entité existe déjà, les autres entités doivent idéalement la **référencer**, plutôt que recopier ses propriétés.

Exemple :

- un personnage possède une dague ;
- son inventaire référence l'objet `Dague` ;
- la fiche `Dague` contient les règles, dégâts, poids, prix, etc. ;
- le moteur de règles actif fournit les informations nécessaires.

### 3.4 Architecture modulaire

Les grands systèmes doivent pouvoir évoluer indépendamment :

- wiki ;
- règles ;
- IA ;
- simulation ;
- cartes ;
- sauvegardes ;
- collaboration ;
- interface.

### 3.5 Les données doivent être séparées de leur affichage

Une même donnée peut être affichée :

- dans une fiche ;
- sur une carte ;
- dans un journal ;
- dans une réponse de l'IA ;
- dans une liste ;
- dans une chronologie.

### 3.6 Les systèmes de règles officiels ne doivent jamais être modifiés directement

Les bases de règles intégrées sont des références.

Toute modification crée une variante/version dérivée.

### 3.7 Priorité à la faisabilité

Le projet sera développé en grande partie par **vibe coding** et avec l'aide d'IA.

Les fonctionnalités doivent donc être :

- découplées ;
- progressives ;
- testables individuellement ;
- raisonnablement implémentables ;
- conçues pour éviter une dette technique massive.

---

# 4. Utilisateurs et modes d'utilisation

Une même personne peut avoir plusieurs rôles dans l'application.

## 4.1 Maître du jeu

Le MJ peut :

- créer un monde ;
- créer/importer son lore ;
- utiliser un monde vierge ;
- générer une partie du contenu ;
- choisir un système de règles ;
- modifier les règles pour son monde ;
- créer des campagnes ;
- créer des personnages et PNJ ;
- préparer des rencontres ;
- gérer les initiatives ;
- consulter les règles ;
- utiliser des générateurs ;
- gérer les secrets et informations cachées ;
- partager son monde avec des joueurs.

## 4.2 Joueur

Le joueur peut :

- rejoindre une campagne via invitation/lien ;
- créer son personnage ;
- consulter les règles autorisées ;
- consulter le wiki auquel il a accès ;
- consulter les cartes autorisées ;
- jouer sans voir les informations secrètes du MJ.

Les informations du wiki doivent être soumises à un système de permissions et de visibilité.

> **Précision (27/07/2026) :** un lien de partage vers le wiki d'un MJ, **sans création de compte**, donne un accès en **lecture seule** au contenu que le MJ a rendu visible aux joueurs. Participer réellement à une campagne (créer un personnage, agir en jeu) nécessite en revanche un compte, pour que la progression du joueur puisse être retrouvée d'une session à l'autre.

## 4.3 Joueur solo

Le joueur solo :

1. choisit ou configure un système de règles ;
2. crée son personnage ;
3. peut définir le type d'aventure recherché ;
4. entre dans un monde généré ou préparé ;
5. joue textuellement avec l'IA comme MJ ;
6. découvre progressivement le monde ;
7. voit le wiki se construire au fur et à mesure de ses découvertes.

## 4.4 Espaces et sauvegardes

L'application doit permettre à un utilisateur de retrouver facilement :

- ses mondes dont il est MJ ;
- ses campagnes où il est joueur ;
- ses parties solo ;
- ses projets en cours de création.

Le rôle de l'utilisateur est donc **lié au contexte**, et non au compte lui-même.

---

# 5. Architecture fonctionnelle générale

Le projet peut être pensé comme plusieurs moteurs communiquant entre eux.

```text
                         APPLICATION
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
      WIKI                RÈGLES                  IA
        │                     │                     │
        ├──────────────┬──────┴──────┬──────────────┤
        │              │             │              │
     CARTES        SIMULATION     CAMPAGNES     GÉNÉRATION
        │              │             │              │
        └──────────────┴──────┬──────┴──────────────┘
                              │
                         SAUVEGARDES
```

Le but n'est pas de construire un monolithe où chaque fonctionnalité dépend directement de toutes les autres.

---

# 6. Wiki vivant et base de connaissances

Le wiki est l'un des piliers du projet.

Il doit fonctionner comme une **base de connaissances interconnectée**, et non comme une collection de pages isolées.

## Fonctionnalités souhaitées

- pages interconnectées ;
- liens automatiques ;
- liens bidirectionnels ;
- recherche ;
- tags ;
- alias ;
- historique ;
- permissions ;
- images ;
- relations ;
- blocs réutilisables ;
- champs structurés ;
- contenu libre ;
- contenu généré par IA ;
- contenu visible uniquement par le MJ ;
- contenu visible uniquement dans certaines campagnes.

## Liens automatiques

Si une page contient le nom ou un alias connu d'une autre entité, l'application peut proposer ou créer automatiquement un lien.

Exemple :

> Les portes de Baldur

Alias :

- Les Portes ;
- Baldur ;
- La Porte, selon le contexte défini.

Une occurrence pertinente peut être reconnue comme une référence vers la fiche correspondante.

Le système doit éviter autant que possible les faux positifs.

## Création rapide

Depuis un texte, l'utilisateur peut pouvoir :

- sélectionner un terme ;
- créer une nouvelle fiche ;
- choisir un modèle/bloc ;
- créer le lien automatiquement.

---

# 7. Architecture modulaire des fiches

Le projet ne doit pas reposer sur une liste rigide de types de pages.

Une fiche est un **conteneur composé de blocs**.

## Noyau commun

Une fiche peut contenir notamment :

- identifiant unique ;
- nom ;
- alias ;
- résumé ;
- description ;
- images ;
- tags ;
- relations ;
- métadonnées ;
- permissions ;
- historique ;
- notes ;
- références externes.

## Blocs spécialisés

Exemples :

- personnage ;
- créature ;
- biologie ;
- croissance ;
- inventaire ;
- équipement ;
- capacités ;
- magie ;
- habitat ;
- relations ;
- objectifs ;
- faction ;
- géographie ;
- chronologie ;
- quête ;
- événement ;
- commerce ;
- statistiques ;
- règles ;
- climat ;
- reproduction ;
- cycle de vie.

Un même objet peut recevoir plusieurs blocs.

### Exemple

Une entité peut être :

```text
Fiche
├── Noyau
├── Biologie
├── Croissance
├── Personnage
├── Relations
└── Inventaire
```

Cela permet notamment de représenter des cas atypiques, comme un personnage issu d'une forme de vie végétale.

## Champs typés

Les champs peuvent être :

- texte ;
- nombre ;
- booléen ;
- date ;
- durée ;
- liste ;
- relation vers une fiche ;
- formule ;
- image ;
- fichier ;
- coordonnées ;
- référence vers une règle.

Les champs structurés sont exploitables par le programme et l'IA.

---

# 8. Moteur de règles

Le moteur de règles doit être **indépendant du wiki et du moteur narratif**.

## Systèmes disponibles initialement

- D&D 2014 ;
- D&D 2024.

À terme :

- autres systèmes ;
- systèmes personnalisés ;
- systèmes entièrement créés par l'utilisateur.

## Format des règles

Les règles doivent pouvoir être représentées sous deux formes complémentaires :

### Vue humaine

Une fiche lisible et explicative.

Exemple pour `Boule de feu` :

- description ;
- fonctionnement ;
- portée ;
- zone ;
- dégâts ;
- conditions ;
- précisions ;
- exemples.

### Vue structurée

Une représentation exploitable par le programme et l'IA :

- identifiant ;
- paramètres ;
- valeurs ;
- formules ;
- conditions ;
- effets ;
- références ;
- interactions avec d'autres règles.

Le JSON est une piste importante pour cette représentation.

## Fiches de règles

Les règles elles-mêmes peuvent être des entités interconnectées.

Exemples :

- sort ;
- classe ;
- sous-classe ;
- compétence ;
- action ;
- objet ;
- arme ;
- armure ;
- condition ;
- monstre ;
- formule ;
- mécanisme de combat.

## Éditeur de règles

L'utilisateur doit pouvoir :

- créer une règle en langage naturel ;
- demander à l'IA de la structurer ;
- modifier la structure ;
- tester la règle ;
- l'utiliser dans son système.

L'IA peut aider à traduire :

```text
"Une épée longue inflige 1d8 dégâts tranchants."
```

vers une structure exploitable par le moteur.

Le moteur doit néanmoins conserver une représentation indépendante du modèle d'IA.

---

# 9. Versionnage et héritage des règles

Principe fondamental :

> **Une partie ne modifie jamais directement un système de règles partagé.**

Exemple :

```text
D&D 2024
   │
   ├── Monde A
   │     └── D&D 2024 modifié
   │
   └── Partie Solo B
         └── D&D 2024 modifié
```

La base originale reste intacte.

## Historique

Le système doit conserver :

- version de départ ;
- modifications ;
- date ;
- auteur ;
- différence entre versions ;
- possibilité de revenir à une version ;
- possibilité de comparer ;
- possibilité de cloner.

## Cohérence des sauvegardes

Une campagne/partie doit pointer vers une **version précise** du système de règles.

Cela garantit qu'une ancienne sauvegarde ne change pas brutalement lorsqu'un système global est modifié.

---

# 10. Assistant IA

L'IA est une couche transversale.

Elle peut intervenir dans :

- le wiki ;
- les règles ;
- la génération ;
- la préparation MJ ;
- les cartes ;
- la simulation ;
- le mode solo ;
- la recherche ;
- l'aide à l'écriture ;
- la transformation de données.

## Génération contextuelle

Dans un champ de texte, l'utilisateur peut commencer à écrire puis demander à l'IA de continuer.

Exemple :

```text
Le personnage a grandi dans une petite ville minière...
```

L'IA peut proposer quelques lignes supplémentaires.

Le contenu reste éditable.

## IA comme outil de codage de règles

À terme, l'IA peut aider à créer des systèmes personnalisés :

1. description en langage naturel ;
2. proposition de structure ;
3. validation par l'utilisateur ;
4. génération des règles structurées ;
5. tests ;
6. intégration dans le système.

---

# 11. Mémoire, contexte et gestion des tokens

C'est un principe architectural majeur.

## Objectif

L'IA doit utiliser **le minimum de contexte nécessaire** pour produire une réponse cohérente.

Elle ne doit pas recevoir tout le wiki à chaque tour.

## Principe

```text
Utilisateur
    │
    ▼
Analyse de la situation
    │
    ▼
Recherche des données nécessaires
    │
    ├── Wiki
    ├── Personnage
    ├── PNJ
    ├── Relations
    ├── Lieu
    ├── Règles
    ├── Inventaire
    └── État du monde
    │
    ▼
Contexte minimal
    │
    ▼
IA
    │
    ▼
Réponse / action
    │
    ▼
Mise à jour des données persistantes
```

## Exemple

Un PNJ possède une fiche.

L'IA n'a pas besoin de mémoriser définitivement :

- son inventaire ;
- toutes ses relations ;
- toutes ses capacités ;
- toute son histoire.

Elle peut rechercher la fiche lorsqu'elle en a besoin.

Si le PNJ reçoit une dague :

1. la fiche du PNJ est mise à jour ;
2. l'inventaire référence la fiche `Dague` ;
3. les propriétés de la dague sont récupérées depuis le système de règles ;
4. l'IA utilise uniquement les informations pertinentes pour la scène.

## Résultat recherché

- moins de tokens ;
- moins de perte de contexte ;
- meilleure cohérence ;
- meilleure persistance ;
- meilleure capacité à faire vivre de grands mondes.

---

# 12. Mode solo

Le mode solo est l'une des fonctionnalités majeures à long terme.

## Concept

L'application joue le rôle de maître du jeu.

Le jeu est principalement **textuel**.

L'objectif est de privilégier :

- narration ;
- dialogue ;
- choix ;
- description ;
- règles ;
- simulation.

Les images peuvent être ajoutées lorsque pertinentes, mais elles ne doivent pas être nécessaires au fonctionnement du jeu.

## Boucle principale

```text
État du monde
      ↓
Action du joueur
      ↓
Recherche du contexte pertinent
      ↓
Application des règles
      ↓
Simulation des conséquences
      ↓
Réponse narrative de l'IA
      ↓
Mise à jour du monde
      ↓
Nouvel état
```

## Configuration

Le joueur peut :

- choisir un système de règles ;
- créer son personnage ;
- personnaliser son personnage ;
- définir quelques préférences d'aventure ;
- choisir ou générer un monde.

Le niveau de personnalisation initial doit rester raisonnable et pourra évoluer.

## Wiki progressif

Le joueur ne connaît pas automatiquement tout le wiki.

Au fur et à mesure qu'il découvre :

- lieux ;
- PNJ ;
- factions ;
- objets ;
- événements ;
- créatures ;

les informations pertinentes peuvent apparaître dans son espace de connaissance.

---

# 13. Simulation procédurale du monde

La simulation doit s'inspirer de l'approche émergente de jeux comme Dwarf Fortress, sans chercher à reproduire toute leur complexité.

## Génération

Un monde peut générer :

- géographie ;
- relief ;
- climat ;
- biomes ;
- ressources ;
- villes ;
- villages ;
- routes ;
- populations ;
- factions ;
- créatures ;
- flore ;
- faune ;
- objets ;
- artefacts ;
- événements historiques ;
- intrigues ;
- relations ;
- conflits.

## Histoire avant le joueur

Le monde peut posséder une histoire générée sur :

- plusieurs années ;
- décennies ;
- siècles.

L'objectif est que le joueur arrive dans un monde qui semble **avoir existé avant lui**.

## Simulation

Le monde peut continuer à évoluer :

- PNJ ;
- factions ;
- villes ;
- économie ;
- conflits ;
- relations ;
- environnement ;
- événements.

Les changements importants sont persistés dans les données.

## Cohérence organique

La génération doit respecter des contraintes logiques.

Exemples :

- implantation des villes liée aux ressources et aux routes ;
- fleuves cohérents avec le relief ;
- biomes cohérents avec le climat ;
- populations adaptées à leur environnement ;
- éviter les implantations absurdes sans raison narrative.

La logique est prioritaire sur l'esthétique.

## Seeds

La génération doit utiliser des **seeds reproductibles**.

Une seed permet de :

- régénérer un monde ;
- partager un monde ;
- réutiliser un monde ;
- conserver une génération identique ;
- créer des variantes à partir d'une base.

## Séparation génération / simulation / rendu

Trois concepts doivent rester distincts :

1. **Génération** : création initiale du monde.
2. **Simulation** : évolution du monde.
3. **Rendu** : représentation visuelle des données.

---

# 14. Cartographie

Les cartes doivent être liées au wiki et aux données du monde.

## Niveaux possibles

- monde ;
- continent ;
- région ;
- royaume ;
- ville ;
- quartier ;
- bâtiment ;
- donjon.

## Interaction

Depuis une carte :

- cliquer sur une ville ouvre sa fiche ;
- cliquer sur une région ouvre sa fiche ;
- sélectionner une route peut afficher ses informations ;
- les éléments du wiki peuvent être localisés sur la carte.

Depuis une fiche :

- accéder à son emplacement sur la carte.

## Calques possibles

- relief ;
- biomes ;
- climat ;
- frontières ;
- routes ;
- fleuves ;
- ressources ;
- villes ;
- populations ;
- lieux importants ;
- événements.

## Génération

Les cartes doivent pouvoir être générées automatiquement.

Le rendu n'a pas besoin d'être photoréaliste.

Une approche **vectorielle/SVG** est envisagée afin de conserver :

- légèreté ;
- zoom ;
- édition ;
- interaction ;
- liens vers les données.

L'inspiration fonctionnelle est notamment **Azgaar's Fantasy Map Generator**.

## Édition

Tout contenu généré doit rester éditable par le MJ autant que possible.

Exemples :

- déplacer une ville ;
- modifier une frontière ;
- modifier un relief ;
- modifier une rivière ;
- supprimer un élément ;
- ajouter manuellement un élément.

Une modification manuelle ne doit pas détruire inutilement l'ensemble de la génération.

---

# 15. Campagnes, parties et sauvegardes

Le projet doit distinguer les différentes couches :

```text
Monde
 ├── Lore / Wiki
 ├── Règles utilisées
 ├── Simulation
 └── Campagnes

Campagne
 ├── Joueurs
 ├── Personnages
 ├── Sessions
 ├── État narratif
 └── Progression

Partie / sauvegarde
 ├── État actuel
 ├── Historique
 ├── Version des règles
 └── État du monde
```

## Sauvegardes

Une sauvegarde doit permettre de reprendre une partie à un état cohérent.

Elle doit conserver notamment :

- état du monde ;
- progression ;
- personnages ;
- règles actives ;
- modifications des règles ;
- historique pertinent.

## Espaces indépendants

Un utilisateur peut simultanément avoir :

- un monde où il est MJ ;
- une campagne où il est joueur ;
- plusieurs parties solo ;
- un monde en cours de création.

---

# 16. Joueurs, MJ, permissions et collaboration

## Permissions

Les données doivent pouvoir avoir des niveaux de visibilité.

Exemples :

- public ;
- joueurs ;
- MJ ;
- utilisateur spécifique ;
- campagne spécifique ;
- privé.

## Secrets

Le wiki peut contenir des informations invisibles aux joueurs :

- identité secrète ;
- intrigue ;
- antagoniste ;
- énigme ;
- événement futur ;
- statistiques cachées.

## Collaboration

À terme, plusieurs MJ peuvent travailler sur le même monde.

Le système pourra prévoir :

- plusieurs propriétaires/collaborateurs ;
- permissions différentes ;
- historique des modifications ;
- attribution des changements ;
- éventuellement commentaires/revisions.

La collaboration n'est pas nécessairement une priorité V1.

---

# 17. Génération de contenu

La génération IA doit être disponible à différents niveaux.

## Contenu possible

- personnages ;
- PNJ ;
- noms ;
- lieux ;
- objets ;
- monstres ;
- quêtes ;
- rencontres ;
- événements ;
- descriptions ;
- lore ;
- règles ;
- intrigues ;
- histoire ;
- factions.

## Génération partielle

L'utilisateur peut fournir un début et demander une continuation.

L'IA doit tenir compte du contenu existant plutôt que repartir de zéro.

## Génération contrôlée

Le contenu généré doit respecter :

- le système de règles ;
- le lore ;
- les données déjà présentes ;
- les relations existantes ;
- les contraintes du monde.

---

# 18. Immersion audiovisuelle

Fonctionnalité plutôt long terme.

## Musique adaptative

La musique/ambiance peut dépendre :

- du lieu ;
- du moment ;
- de l'activité ;
- du danger ;
- du combat ;
- de l'ambiance narrative.

Exemples :

- taverne → ambiance de taverne ;
- combat → musique plus épique ;
- exploration → ambiance adaptée au lieu.

L'audio reste optionnel et ne doit pas être nécessaire au fonctionnement du jeu.

---

# 19. Recherche, navigation et interconnexion

Le volume de données pouvant devenir très important, la recherche doit être une fonctionnalité centrale.

## Recherche

Elle devrait pouvoir rechercher :

- noms ;
- alias ;
- contenu ;
- tags ;
- relations ;
- types de blocs ;
- règles ;
- lieux ;
- personnages ;
- objets.

## Graphe de connaissances

Les relations entre fiches peuvent former un graphe.

Exemple :

```text
PNJ
 ├── habite → Ville
 ├── appartient → Faction
 ├── connaît → PNJ
 ├── possède → Dague
 ├── déteste → PNJ
 └── a participé → Événement
```

Ce graphe peut alimenter :

- navigation ;
- recherche ;
- IA ;
- génération ;
- simulation ;
- affichage des relations.

---

# 20. Architecture technique et contraintes de développement

## Vibe coding

Le développement est pensé pour être fortement assisté par des IA de programmation.

Le projet doit donc privilégier :

- architecture claire ;
- petits modules ;
- documentation ;
- interfaces explicites ;
- données structurées ;
- tests simples ;
- fonctions indépendantes ;
- faible couplage.

## Principe de construction

Priorité :

```text
Données
  ↓
Logique
  ↓
API / services
  ↓
Interface
  ↓
Automatisation IA
  ↓
Effets avancés
```

Le modèle de données doit être stabilisé suffisamment tôt.

## Technologies envisagées

Le choix définitif reste ouvert.

Pistes déjà cohérentes avec les objectifs :

- données structurées/JSON ;
- Python pour certains moteurs de génération ;
- SVG pour les cartes ;
- stockage persistant adapté aux relations entre entités ;
- Git pour la documentation et éventuellement certaines données de projet.

Ces choix sont à confirmer lors de la phase technique.

---

# 21. Liberté des composants et commercialisation

Le projet doit être conçu dès le départ pour éviter une dépendance inutile à des composants propriétaires ou à des licences incompatibles avec une future commercialisation.

## Principes

- privilégier les composants libres ou permissifs ;
- vérifier les licences avant intégration ;
- conserver une liste des dépendances et licences ;
- séparer les données propriétaires des composants génériques ;
- éviter les dépendances qui empêcheraient une commercialisation future.

## Règles de jeu

D&D 2014 et D&D 2024 sont les systèmes intégrés envisagés par défaut.

La question exacte des droits, licences, contenus de règles et conditions d'utilisation doit être **vérifiée juridiquement avant commercialisation**.

Le projet doit être capable de fonctionner avec des systèmes de règles personnalisés et d'autres contenus libres, afin de ne pas dépendre d'une seule propriété intellectuelle.

---

# 22. Feuille de route indicative

Cette feuille de route est volontairement approximative.

## V1 — Fondations

Objectif : construire le noyau utilisable.

- architecture des données ;
- système de projet/monde ;
- wiki ;
- fiches modulaires ;
- liens entre fiches ;
- alias ;
- recherche ;
- sauvegarde ;
- permissions de base ;
- moteur de règles ;
- D&D 2014 ;
- D&D 2024 ;
- versionnage des règles ;
- assistant IA de base ;
- génération de texte ;
- gestion des personnages ;
- outils MJ essentiels.

## V2 — Jeu et simulation

- mode campagne plus complet ;
- outils de combat ;
- initiative ;
- générateurs ;
- cartes ;
- génération procédurale ;
- seeds ;
- simulation du monde ;
- évolution des PNJ ;
- chronologie ;
- meilleure gestion des secrets.

## V3 — Solo et monde vivant

- MJ IA ;
- contexte minimal dynamique ;
- simulation avancée ;
- histoire générée ;
- wiki progressif ;
- génération plus poussée ;
- systèmes de règles personnalisés ;
- IA capable d'aider à coder les règles.

## V4 — Collaboration et immersion

- collaboration multi-MJ ;
- permissions avancées ;
- audio adaptatif ;
- outils de partage ;
- import/export avancé ;
- cartes plus interactives ;
- amélioration du rendu.

Cette feuille de route n'est pas contractuelle. Elle doit évoluer avec les contraintes techniques et les tests.

---

# 23. Décisions validées

Cette section contient les décisions considérées comme acquises à la version 0.1.

- [x] Application centralisée pour MJ, joueurs et solo.
- [x] Le projet est plus large qu'un simple compagnon D&D.
- [x] D&D 2014 disponible par défaut.
- [x] D&D 2024 disponible par défaut.
- [x] Systèmes de règles personnalisables.
- [x] Moteur de règles séparé du reste de l'application.
- [x] Règles lisibles par l'humain + représentation structurée.
- [x] Versionnage et héritage des règles.
- [x] Les règles de base ne sont jamais modifiées directement.
- [x] Wiki comme source de vérité.
- [x] Wiki interconnecté.
- [x] Alias pour les liens.
- [x] Fiches composées de blocs.
- [x] Champs structurés et typés.
- [x] Références entre entités plutôt que duplication des données.
- [x] IA comme assistante.
- [x] Contenu généré modifiable.
- [x] Contexte IA minimal.
- [x] Recherche des données au moment où elles sont nécessaires.
- [x] Mode solo textuel avec IA comme MJ.
- [x] Génération de mondes.
- [x] Simulation du monde.
- [x] Histoire préexistante générée.
- [x] Seeds reproductibles.
- [x] Cartes générées.
- [x] Cartes simples et fonctionnelles plutôt que graphiquement ambitieuses.
- [x] Rendu SVG envisagé.
- [x] Cartes éditables.
- [x] Séparation données / simulation / rendu.
- [x] Sauvegardes distinctes selon les mondes/campagnes/parties.
- [x] Un utilisateur peut avoir plusieurs rôles selon le contexte.
- [x] Permissions et contenu caché pour les joueurs.
- [x] Collaboration multi-MJ envisagée à terme.
- [x] Priorité à une architecture faisable par vibe coding.
- [x] Priorité aux composants libres et à une future commercialisation possible.

## Ajouts suite au démarrage technique (27/07/2026)

- [x] Frontend : Next.js (App Router, TypeScript, Tailwind CSS).
- [x] Backend/BDD : Supabase (PostgreSQL + Auth + Row Level Security).
- [x] Application web (pas desktop/hybride pour l'instant).
- [x] Authentification V1 : email/mot de passe via Supabase Auth (autres méthodes possibles plus tard).
- [x] Accès au wiki par lien sans compte : lecture seule uniquement ; jouer réellement nécessite un compte (voir section 4.2).

---

# 24. Questions ouvertes

Ces questions ne bloquent pas la conception générale, mais devront être décidées.

## Architecture

- Où stocker les fichiers/images ? *(le reste des questions d'architecture a été tranché le 27/07/2026, voir section 23)*

## IA

- Quel(s) modèle(s) ?
- Modèle local, API externe, ou les deux ?
- Quel mécanisme de recherche de contexte ?
- Comment détecter automatiquement les données à récupérer ?
- Comment éviter les hallucinations ?
- Comment valider les modifications produites par l'IA ?

## Règles

- Schéma JSON exact ?
- Comment représenter les formules ?
- Comment représenter les déclencheurs ?
- Comment exécuter les règles en toute sécurité ?
- Comment importer les systèmes existants ?
- Comment gérer les conflits entre modules ?

## Wiki

- Comment gérer les homonymes ?
- Comment gérer les alias ambigus ?
- Comment créer automatiquement les liens sans faux positifs ?
- Quel niveau d'édition Markdown/WYSIWYG ?
- Comment gérer les relations complexes ?

## Simulation

- Quel niveau de détail ?
- Quelle fréquence de simulation ?
- Quelles entités sont simulées en permanence ?
- Comment réduire le coût de calcul ?
- Comment gérer les événements à grande échelle ?

## Cartes

- Quelle méthode de génération de relief ?
- Comment calculer les fleuves ?
- Comment générer les biomes ?
- Comment éditer une carte générée sans perdre la simulation ?
- Comment gérer les niveaux de zoom ?

## Notes techniques (27/07/2026)

Remarques issues du démarrage de l'implémentation, à garder en tête pour la suite :

- Le périmètre de ce document (25 sections) est large et volontairement exploratoire. La feuille de route (section 22) fait déjà le tri utile pour la V1 — s'y tenir strictement évite la dispersion, en cohérence avec le principe 3.7 (faisabilité, petites étapes testables).
- Le "lien sans compte" vers un wiki (section 4.2) demandera un mécanisme distinct de celui déjà construit pour le MJ/les joueurs identifiés (RLS Postgres basée sur `auth.uid()`) : une route serveur avec jeton d'invitation, qui résout elle-même la visibilité (cohérent avec la règle déjà posée dans `Phase0_Schema_Technique_v0_1.md` : la résolution de visibilité se fait toujours côté serveur, jamais côté client). À construire seulement une fois qu'un vrai wiki existe à partager.
- Les permissions actuelles (RLS) ne distinguent pas encore MJ vs joueur au sein d'une même campagne (section 16) : pour l'instant, seul le propriétaire du monde peut écrire. À affiner quand les campagnes seront réellement utilisées.

---

# 25. Idées futures

Cette section est volontairement ouverte.

- génération de mondes à plusieurs échelles ;
- simulation géologique ;
- simulation climatique ;
- simulation écologique ;
- faune/flore générées et interdépendantes ;
- économie simulée ;
- politique et diplomatie simulées ;
- relations sociales entre PNJ ;
- événements émergents ;
- chronologie dynamique ;
- cartes générées à partir de la simulation ;
- génération d'images optionnelle ;
- musique adaptative ;
- sons d'ambiance ;
- collaboration temps réel ;
- système de plugins ;
- marketplace éventuelle ;
- import/export de mondes ;
- partage de seeds ;
- bibliothèque communautaire de systèmes de règles ;
- création de systèmes entièrement nouveaux avec l'aide de l'IA.

---

# Convention de maintenance du document

Ce document doit rester une **source de vérité vivante**.

Lorsqu'une nouvelle idée est ajoutée :

1. déterminer si elle modifie une décision existante ;
2. l'ajouter dans la section fonctionnelle correspondante ;
3. ajouter une décision validée si elle est approuvée ;
4. déplacer les idées non décidées vers `Questions ouvertes` ou `Idées futures` ;
5. conserver les contradictions et changements importants dans l'historique du projet.

## Statuts recommandés

- `IDÉE` : idée proposée, non décidée.
- `À DISCUTER` : nécessite une décision.
- `VALIDÉ` : décision prise.
- `EN DÉVELOPPEMENT` : implémentation en cours.
- `IMPLÉMENTÉ` : fonctionnalité disponible.
- `REPORTÉ` : fonctionnalité volontairement repoussée.
- `ABANDONNÉ` : fonctionnalité écartée.

---

# Historique des versions

## v0.1 — 27/07/2026

Première synthèse du brainstorming initial.

Contenu :

- vision du projet ;
- modes MJ / joueur / solo ;
- wiki vivant ;
- fiches modulaires ;
- moteur de règles ;
- D&D 2014 / 2024 ;
- règles personnalisées ;
- héritage et versionnage ;
- IA et contexte minimal ;
- simulation procédurale ;
- seeds ;
- cartographie ;
- campagnes et sauvegardes ;
- permissions ;
- collaboration ;
- génération ;
- audio adaptatif ;
- contraintes de vibe coding ;
- principes de liberté/licences ;
- feuille de route initiale.

## Alignement technique — 27/07/2026

Sans changer le numéro de version du document (reste v0.1), le début de l'implémentation a permis de trancher plusieurs questions ouvertes et de préciser un point du fonctionnement des joueurs. Voir aussi `Phase0_Schema_Technique_v0_1.md` et `ROADMAP.md` pour le détail technique et l'état d'avancement.

- choix d'architecture retenus (section 23) : Next.js + Supabase (PostgreSQL, Auth, RLS) ;
- précision sur l'accès par lien au wiki : lecture seule, sans compte (section 4.2) ;
- notes techniques ajoutées en section 24, à ne pas perdre de vue pour la suite.

---

# Fin du document

**Prochaine étape recommandée :** continuer le brainstorming sans chercher immédiatement à spécifier techniquement chaque fonctionnalité. Les décisions prises pourront ensuite être intégrées à ce document avant de passer à l'architecture technique détaillée.
