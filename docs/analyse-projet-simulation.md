# Analyse — le projet de simulation (JDRSim)

**Version :** 0.1 — 8 septembre 2026
**Statut :** analyse. Les décisions marquées « tranché » l'ont été en relecture avec l'auteur.
**Source :** un document de conception en trois onglets, antérieur à CreaDonjon, décrivant un simulateur de monde couplé à un moteur de JDR textuel. Non versionné : sa place est `data/personnel/`.

> **Document frère :** `docs/analyse-prompt-origine.md`. Le prompt d'origine disait ce que l'auteur voulait *jouer* ; celui-ci dit ce qu'il voulait *construire*. Les deux se recoupent, et là où ils divergent, celui-ci est plus mûr.

---

## 0. Ce que ce document est

Ce n'est pas un second prompt. C'est une spécification de produit, et elle est arrivée seule à la thèse de CreaDonjon :

> « Python calcule toutes les règles, les jets de dés et les conséquences. Un modèle de langage local se charge uniquement de la narration — il reçoit des faits calculés et les met en mots. »

C'est la règle absolue 8, écrite avant qu'elle existe ici. Le proto et l'application ont convergé par deux chemins ; c'est le meilleur argument qu'on ait que cette architecture est la bonne.

Mais il vise autre chose : **un simulateur de monde à la Dwarf Fortress.** Worldgen géologique, LOD, 231 matériaux, économie et politique émergentes. Le recouvrement avec CreaDonjon est réel et partiel — d'où un tri en trois, pas en deux.

---

## 1. Le critère de tri

Une seule ligne, et elle décide de tout le reste :

> **Le mécanisme est générique et vit dans le code. Le vocabulaire appartient au ruleset et vit dans les données.**

| Générique — donc en dur | Vocabulaire — donc en donnée |
|---|---|
| Dés, formules en AST, RNG serveur | Quelles caractéristiques existent, comment on en tire un modificateur |
| Empilement de modificateurs, sept couches | Quelles compétences existent, quelle caractéristique les gouverne |
| Déclencheurs, événements, bornes | Monnaie : dénominations et taux |
| Entités, blocs, visibilité, révisions, découvertes | Capacité de charge et paliers d'encombrement |
| Moteur de tirage : tables, paliers, emplacements | Le *contenu* des tables |
| **Worldgen** : géographie, climat, factions, histoire | Quelles espèces, quels monstres, quelles ressources il peuple |

L'exemple qui rend la frontière concrète : **`(score − 10) / 2` est enfoui dans le moteur alors que c'est purement D&D.** Un ruleset doit pouvoir déclarer sa propre formule — et le parser d'AST existe déjà pour l'évaluer. Ce n'est pas une machinerie à construire, c'est une constante à déplacer.

---

## 2. A — Les outils génériques

Ce que le document apporte et qui manque à l'application, indépendamment de tout système de règles.

| Élément | État chez nous |
|---|---|
| **Fiabilité des sources dans le wiki** — 👁 observé, 💬 PNJ de confiance, 🍺 rumeur, 📜 document | **manque entièrement.** Voir §2.1 |
| **Langue inconnue rendue en charabia** | manque. Générique, et c'est un cas de résolution serveur |
| **Ellipse temporelle comme mécanisme** — « je passe un mois à m'entraîner » | manque. S'articule avec l'horloge de l'état de scène |
| **LOD narratif** — 3 000 cerfs restent un agrégat tant que le joueur est loin, deviennent des individus au contact | manque, et c'est une réponse générique au coût du contexte IA |
| Préfixes « GM : » / « RP : » | déjà prévu (V3-R5) |
| Bloc-notes joueur, modifiable par lui seul | déjà prévu (`module-joueur-et-solo.md` §D) |
| Panneaux qui n'apparaissent qu'une fois utiles (sorts, propriétés) | même principe que l'onglet Magie masqué pour un barbare |
| Visée ciblée, blessures localisées | **rien à écrire** : ce sont des déclencheurs. Si V3-A1 ne sait pas les exprimer, c'est V3-A1 qui a un problème |
| Titres générés depuis les compétences les plus hautes | un générateur composé, mécanisme déjà en place |
| Mémoire émotionnelle, rumeurs qui se déforment | recoupe V3-S3 |

### 2.1 La fiabilité des sources mérite qu'on s'y arrête

`entity_discoveries` dit **que le joueur sait** quelque chose. Elle ne dit rien de **à quel point c'est vrai**.

Sans ce champ, un wiki solo affiche une rumeur de taverne avec exactement la même autorité qu'un fait observé de ses yeux — et c'est précisément ce qui tue la tension d'un jeu où l'on enquête. Le document propose quatre niveaux ; c'est un champ sur la découverte, pas un système.

C'est petit, et ça change beaucoup. C'est l'apport le plus net de tout le document.

---

## 3. B — Le ruleset : ce que le moteur doit savoir exprimer

**Tranché (8 septembre).** Le besoin n'est pas d'implémenter JDRSim. Il est de **basculer d'un ruleset à l'autre sans mélange, et que tous les outils suivent** — générateurs, création de personnage, rencontres, fiche.

### 3.1 Ce qui marche déjà

Le cloisonnement redouté est **déjà garanti par l'architecture**, pas par de la discipline :

- un monde porte un ruleset (`worlds.default_ruleset_id`), une campagne épingle sa version précise (`campaigns.ruleset_id`), et « un monde = une campagne » ;
- les bases officielles sont verrouillées en base (`is_official_base`) : un ruleset personnel ne peut pas déteindre dessus ;
- l'**import/export JSON existe** (V2-J4), avec un assistant de correspondance pour un format tiers, et un ruleset importé naît `personal_reference`, donc non partageable.

Trois outils vont déjà chercher dans le ruleset actif : le créateur de personnage (`assembleResolvedRuleset`, chaîne d'héritage comprise), la fiche jouable, et le générateur de rencontres — ce dernier étant le modèle à suivre : **le budget de difficulté est lu dans l'entrée `encounter-budget` du ruleset**, jamais codé.

### 3.2 Ce qui ne suit pas — la liste est finie

| Ce qui ne suit pas | Constat |
|---|---|
| **Les générateurs de MJ** | Leur contenu vit sur une entité `generateur` du **monde** (`ensureGeneratorToolsEntity`), pas dans le ruleset. Basculer le ruleset ne change rien à Taverne, PNJ, Noms, Échoppe, Butin |
| **`rule_query`** — l'emplacement qui interroge le ruleset au lieu d'une table | Spécifié dans `outils-mj.md` §3, **jamais implémenté** — noté comme écart assumé dans `src/core/generators/types.ts` |
| **Les 18 compétences** | `SKILL_ABILITIES` en dur dans `src/core/rules/sheet.ts` |
| **Les 6 caractéristiques** | `type Ability = "str" \| "dex" \| ...`. **32 fichiers** y touchent |
| **La formule de modificateur** | `(score − 10) / 2`, en dur, alors que l'AST saurait l'évaluer |
| **Monnaie et encombrement** | Constantes — `COIN_VALUE_CP`, `CAPACITY_MULTIPLIER` |
| **`entry_type`** | Liste fermée de 14 valeurs : pas de `skill`, pas de `craft` |

### 3.3 Le critère de fin

> **Basculer le ruleset actif d'un monde change ce que proposent tous les outils, sans qu'aucune valeur ne subsiste de l'ancien.**

Vérifiable par son contraire, qui est le vrai garde-fou : **charger un ruleset vide ne doit laisser fuir aucune valeur D&D.** Si un générateur propose encore « elfe », si la fiche affiche encore « Acrobaties », c'est qu'il reste du D&D en dur. Un test d'intégration, comme la règle ESLint qui protège `src/core` — pas une intention.

### 3.4 Les caractéristiques : la version raisonnable

C'est le plus gros élément du backlog, devant les déclencheurs. La version qui évite le pire :

**Le ruleset déclare la liste ; le moteur la traite comme opaque.** Les rulesets SRD déclarent les six habituelles, donc rien ne change pour les mondes existants et **aucune migration de données n'est nécessaire** — les six clés restent valides, elles cessent d'être les seules possibles.

Deux conséquences à assumer : « tableau standard / achat de points / tirage » deviennent de la donnée de ruleset (ils supposent six valeurs), et les six pastilles de la fiche jouable deviennent une boucle.

C'est la règle des trois appliquée : on ne construit pas un système de statistiques universel, on arrête de coder la liste en dur.

---

## 4. C — Le worldgen

**Tranché (8 septembre) : en périmètre, mais après la V3.** Le worldgen est un préalable du jeu solo — sans monde préexistant, il n'y a rien à découvrir.

Il est **générique** au sens du §1 : géographie, climat, factions, histoire et populations ne dépendent d'aucun système de règles. Il vit donc dans le code.

Mais **ce dont il peuple le monde est du vocabulaire de ruleset** : quelles espèces existent, quels monstres, quelles ressources. Il ira les chercher par le même passage que les générateurs, `rule_query`. Un seul mécanisme, trois consommateurs — générateurs, créateur de personnage, worldgen. Par la règle des trois, ça justifie de le construire proprement une fois.

### 4.1 Une distinction à faire avant d'écrire quoi que ce soit

« Worldgen » recouvre deux choses dont l'écart est d'un ordre de grandeur :

| | Ce que c'est | Portée |
|---|---|---|
| **Monde amorcé** | une région, quelques factions avec leurs intérêts, deux ou trois siècles d'histoire, des populations | suffit largement à jouer en solo ; à portée après la V3 |
| **Simulation géologique** | proto-planète, tectonique, hydrologie, 231 matériaux, 10 000 ans tick par tick | le projet du document ; une année de travail à lui seul |

**Tranché le 8 septembre : le monde amorcé.** Il suffit à jouer et ne ferme aucune porte — on peut lui ajouter de la profondeur plus tard, alors que commencer par la géologie mettrait une année de travail avant la première partie jouable.

Conséquence directe : les 231 matériaux, les objets calculés depuis un matériau et le `tick_history` ne sont pas nécessaires. Ils restent hors périmètre avec les sorts composables (§5).

### 4.2 Une conséquence immédiate, même sans rien construire

Le worldgen **crée des entités par milliers**, là où le wiki actuel suppose des fiches écrites à la main. Ça ne bloque rien aujourd'hui, mais rien de ce qu'on construit d'ici là ne doit supposer le contraire — ni l'arborescence, ni la recherche, ni le fil d'activité.

---

## 5. Le point de rupture

Une phrase du document est incompatible avec l'architecture actuelle, et il vaut mieux la nommer que la découvrir en chemin :

> « Il n'existe pas d'objets prédéfinis dans le jeu. Un objet est le produit d'une forme, de composants fonctionnels et des matériaux qui les constituent. »

Chez nous, une dague est une **entrée de ruleset** avec une clé stable (`entry_key`). C'est cette clé qui rend possibles la surcharge, la traduction, les renvois et les révisions. Un objet calculé à la volée depuis un matériau n'a pas de clé — donc rien de tout ça.

Le même problème se pose pour les **sorts composables** du document (intention × vecteur × élément × portée, coût calculé, nom généré) : un sort composé n'a pas de clé stable non plus.

Il existe probablement une sortie — **composer puis figer** une entrée avec une clé dérivée de ses composants, ce qui rendrait le résultat surchargeable et traduisible comme n'importe quelle autre entrée. Mais c'est un ADR, pas un ticket, et il conditionne toute la partie « matériaux » et « sorts composables » du ruleset.

---

## 6. Où va quoi

| Sujet | Destination |
|---|---|
| Fiabilité des sources, langues inconnues | `BACKLOG_V3.md` lot O |
| Ellipse temporelle, LOD narratif | `BACKLOG_V3.md` lot R |
| Caractéristiques, compétences, `rule_query`, générateurs de ruleset, test du ruleset vide | `BACKLOG_V3.md` lot Q, reformulé |
| Visée ciblée, blessures localisées | rien — ce sont des déclencheurs (V3-A1) |
| Worldgen | `ROADMAP.md` et une entrée V4 du backlog |
| Clé stable d'une entrée composée | un ADR, préalable aux matériaux et aux sorts composables |
| Les 8 races, 12 archétypes, 10 origines, le système de mana | **rien dans le backlog** — ce sont les données que l'auteur écrira dans son JSON une fois le lot Q livré. Le jeu d'essai, pas le travail |

---

## 7. En une phrase

Ce document décrit deux projets : une application de JDR dont CreaDonjon est déjà la moitié, et un simulateur de monde qui reste à faire. Le tri se ramène à une seule question posée à chaque ligne — **est-ce un mécanisme ou du vocabulaire ?** — et la réponse dit si ça va dans le code ou dans le ruleset.
