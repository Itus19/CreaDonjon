# Backlog V3 — Le monde qui se joue tout seul

**Version :** 1.0 — 6 septembre 2026
**Établi sur :** l'état réel du dépôt à `6851a0f`, vérifié fichier par fichier.
**Documents liés :** `specs/moteur-de-jeu.md` · `specs/module-joueur-et-solo.md` · `docs/adr/0009-viabilite-solo.md` · `specs/outils-mj.md` · `specs/psyche-pnj.md` · `docs/SCHEMA.md`

---

## 0. Ce que S1 a changé, et qu'il faut avoir en tête partout

`docs/adr/0009` a tranché : **MJ assisté, pas MJ autonome.** Les mesures objectives passaient toutes (latence, tokens, zéro identifiant inventé) ; c'est la cohérence narrative dans la durée qui a déçu — répétitions verbatim, dérive de personnage, PNJ qui commente une scène qu'il a quittée.

La conclusion n'est pas « le solo ne marche pas ». Elle est plus précise, et elle oriente tout ce backlog :

> **Le moteur joue le MJ. Le modèle l'habille.**

Autrement dit, à chaque tour, la part déterministe doit être **majoritaire** : le lieu, l'heure, qui est présent, ce qui est tiré, ce qui est calculé, ce qui est écrit en base. Le modèle reçoit tout ça et produit deux à quatre phrases. S'il rate, la partie continue — on a perdu de la prose, jamais un fait.

Trois trous précis ont été identifiés dans le spike, et chacun a son ticket ici :

| Trou constaté (ADR 0009) | Où il est traité |
|---|---|
| Aucun suivi de scène : les PNJ « présents » restaient figés toute la session | **V3-A4**, puis **V3-B2** |
| Le contexte de personnage était un instantané pris une fois | **V3-B3** |
| Rien ne forçait le passage par la résolution mécanique avant de narrer un combat | **V3-B1** (la barre d'intention) — c'est le ticket le plus important du lot B |
| Pas de voie pour faire parler un PNJ incident sans lui inventer un identifiant | **V3-C2** (l'esquisse) |

Et le point resté ouvert dans l'ADR — *« le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout »* — est repris en tête de ce backlog sous **V3-S2**.

---

## 1. Ce qui existe déjà — inventaire vérifié au 6 septembre

Il faut le lire avant de commencer : **une grande partie du solo est déjà construite**, dispersée dans la V1 et la V2. La V3 est surtout du câblage.

| Brique | Où | État |
|---|---|---|
| Formules en AST, parser fermé, RNG injecté | `src/core/formula`, `src/core/dice` | complet |
| Jets d'attaque, caractéristique, dégâts, avantage | `src/core/rules/action.ts` | complet |
| Fiche dérivée, sept couches de modificateurs | `src/core/rules/sheet.ts` | complet |
| Initiative, ordre du tour | `src/core/rules/combat.ts` | minimal mais juste |
| Générateurs : Taverne, PNJ, Noms, Échoppe, Butin | `src/core/generators/`, `tools.ts` | complet, avec variantes et paliers |
| **Promotion générateur → fiche wiki** | `src/server/services/promotion.ts` | **complet** — crée entité + blocs typés + références |
| Psyché des PNJ : pôles, attitudes, souvenirs | `src/server/services/psyche.ts`, `src/core/psyche` | complet |
| Quêtes actives, déjà filtrées par visibilité | `src/server/services/quests.ts` | écrit, **aucun consommateur** |
| Journal de session en ajout seul | `session_events` | complet depuis la Phase 0 |
| Découvertes par campagne | `entity_discoveries` | table créée, **jamais écrite** |
| Propositions de l'IA validées avant application | `ai_proposals` + `src/server/services/aiProposals.ts` | complet, y compris `auto_applied` |
| Fournisseur d'IA local derrière une interface | `src/server/ai/`, `AiProvider` | complet |
| Encadrement du contenu non fiable dans un prompt | `src/core/ai/promptSafety.ts` | complet |
| Calendrier du monde, dates en jeu | `src/core/calendar`, `getCalendar` | complet |
| Fiche jouable tenue à 375 px | `PlayableCharacterSheet.tsx` | complet |
| Coquille joueur responsive | `PlayerShell.tsx` | complet |
| Rendu du wiki public en trois zones | `app/partage/**`, `BookSkin.tsx` | complet |

**Ce qui manque vraiment**, et rien d'autre : les déclencheurs, l'économie d'action, l'état de scène, la boucle de tour, le pont entre le moteur et les générateurs, et l'écran.

---

## 2. Principe de séquencement

> **Reboucler le doute de S1 d'abord. Puis le moteur. Puis la boucle. Puis l'écran.**

```
S2       reboucler le lien fait-mécanique → narration      1 jour, avant tout
Lot A    le moteur                    déclencheurs, économie d'action, scène
Lot B    la boucle de tour            intention → résolution → narration → journal
Lot C    le monde qui s'écrit         générateurs, esquisses, wiki, découvertes
Lot D    l'interface solo             les trois colonnes
Lot E    la mémoire                   résumés, RAG, continuité entre séances
Lot F    la partie qui dure           reprise, sauvegarde, bascule vers une campagne
Lot R    la rapidité, et le téléphone  hors séquence — les restes de l'audit, à tout moment
```

**A avant B avant C** — ce sont de vraies dépendances, pas une préférence : la boucle a besoin de l'état de scène, et l'écriture du monde a besoin de la boucle.

**D peut commencer en parallèle de C.** L'écran se construit contre des données factices sans rien attendre ; c'est même souhaitable, parce que voir l'écran change la conception du reste.

**Le lot R est hors de cette séquence.** Il ne construit pas le solo : il reprend les constats de rapidité de l'audit restés ouverts, centrés sur le téléphone. Il n'a aucune dépendance vers les autres lots et aucun autre lot ne l'attend. Ses deux premiers tickets (`V3-R0`, `V3-R6`) tiennent en une soirée et devraient être faits tôt, parce qu'ils disent si le reste vaut la peine.

**E et F attendent une vraie partie jouée.** Concevoir la mémoire longue avant d'avoir joué trois séances, c'est deviner.

---

## S2 — Reboucler le lien fait-mécanique → narration · `S`

**Ce n'est pas un ticket de fonctionnalité, c'est la dette de S1.** L'ADR 0009 le dit explicitement : *« Avant toute conclusion définitive : reboucler spécifiquement le lien fait-mécanique → narration, jamais réellement exercé dans ce spike (panne d'infrastructure sur l'unique tentative). »*

Le combat des tours 2 à 4 du spike a été narré sans qu'aucun dé réel ne soit lancé. La garantie centrale du projet — le modèle ne calcule rien — n'a donc jamais été observée de bout en bout.

- [x] Réutiliser `/spike-solo`, sans rien reconstruire : dix tours de combat, chacun **obligatoirement** précédé d'une résolution mécanique réelle (`resolveAction`), la case à cocher facultative retirée. **Fait le 19 septembre** — et la résolution ne se contente pas d'être obligatoire : si elle échoue, le tour s'arrête sans appeler le modèle.
- [x] Mesurer : le modèle reprend-il fidèlement les nombres fournis ? **0 écart sur 10 tours.**
- [x] Mesurer : invente-t-il un fait mécanique absent du contexte ? **0 sur 10.**
- [x] Écrire le verdict dans `docs/adr/0009` — amendement daté du 19 septembre, ajouté sous l'original.

**Verdict : le lien tient, le lot B peut s'écrire en prose libre.** Les gabarits à trous prévus en cas d'échec ne sont pas nécessaires. Trois réserves à lire avec le résultat : dix tours c'est peu ; Bram est tombé à 0 PV dès le tour 4, donc « PV restants » n'a réellement été éprouvé que sur trois transitions (9 → 5 → 2 → 0) ; et les défauts qualitatifs de S1 (réplique attribuée au mauvais PNJ, répétition verbatim, PNJ qui commentent sans raison) sont tous revenus — ce qui **confirme** le repli sur le MJ assisté. Mesure annexe : 1 364 tokens d'entrée par tour, soit plus du double du budget de 600 fixé par les critères transverses ci-dessous — à traiter dans le lot B.

**Le banc d'essai était cassé, et le réparer a révélé six défauts réels.** S2 disait « sans rien reconstruire », en supposant `/spike-solo` fonctionnel. Il ne l'était plus depuis un mois :

1. **`npm run ingest:srd` échouait sur toute base neuve depuis le 17 août** — `app.import_upsert_ruleset` (30 juillet) insère un ruleset officiel sans renseigner `content_origin`, colonne ajoutée ensuite avec une contrainte de cohérence. Invisible en production, où le SRD précédait la contrainte ; fatal sur le chemin d'amorçage documenté (`db reset` + `ingest:srd`). Corrigé par la migration `20260919120000`.
2. **Les constantes du spike pointaient sur la fixture d'avant « un monde = une campagne »** (26 août) : la campagne visée n'existait plus. Repointées sur les identifiants `bbbbbbbb-*`.
3. **`seed-dev.ts` écrivait un `entity_runtime_state` incomplet** — cinq champs ajoutés à `zRuntimeState` après lui manquaient, et la lecture valide strictement.
4. **`scripts/write-encounter-budget-2024.ts` codait en dur l'UUID de production** du ruleset SRD 5.2.1 — identifiant généré à l'import, donc différent sur chaque base : violation de clé étrangère sur toute base neuve, et donc aucune table de budget de rencontre. Corrigé par une résolution via `base_system`.
5. **Le générateur de rencontres optimise un budget de PX, pas la présence d'une attaque.** Une fois le budget rétabli, il a rendu un *Shrieker* — un champignon sans `attack_bonus`, sur lequel `resolveMonsterAttackOnBram` échoue. Or S2 exige une résolution réelle à chaque tour. Le spike prend désormais un adversaire **nommé et déterministe** (le bandit, cimeterre +3, 1d6+1) : deux mesures ne se comparent pas si l'adversaire change d'une exécution à l'autre. Le générateur n'est pas ce que S2 mesure.
6. **Le monde solo ne contient aucun lieu.** L'Ancre Rouillée vit dans Valdoria ; le spike la lit là-bas pour préserver le décor de S1.
Aucun de ces six défauts ne se trouve en relisant le code : ils apparaissent en montant une instance neuve. **Le chemin d'amorçage du projet n'avait pas été rejoué depuis un mois.**

**Seuil d'échec :** plus d'un tour sur dix où un nombre fourni est contredit. Au-delà, la narration doit être encadrée davantage (gabarits à trous plutôt que prose libre) — et ça change le lot B, donc il faut le savoir avant.

---

# Lot A — Le moteur

*Reprend `specs/moteur-de-jeu.md` §8 sans en changer la numérotation. Détail de conception dans la spec ; ici, seulement les critères d'acceptation et ce que la spec laissait ouvert.*

### V3-A1 — Déclencheurs : schéma, évaluateur, bornes · `L` — **fait le 19 septembre**

Le cœur. Fonction pure, aucune base, aucun réseau. **Tests avant le code** — les cas dorés sont des règles réelles.

- [x] `src/core/rules/triggers.ts` : `zTrigger` (Zod), un évaluateur, rien d'autre.
- [x] Le `if` réutilise l'AST existant pour ses feuilles numériques, enveloppé d'une couche booléenne `and`/`or`/`not`/`eq`/`gte`/`lte`/`has_condition`/`has_feature`/`in_range` — voir **ADR 0027** : `FormulaNode` est strictement numérique, l'étendre aurait imposé un retour `number | boolean` à `evaluate()`, appelé partout dans le moteur de fiche. Les nombres, eux, n'ont bien aucune grammaire nouvelle.
- [x] Vocabulaire d'événements fermé (les 18 de la spec §4), plus les 10 effets, également fermés.
- [x] Les quatre bornes. Trois sont vérifiées à l'exécution (profondeur, déclencheurs par événement, un même déclencheur une fois par événement émis) ; **la quatrième, 8 effets par déclencheur, est vérifiée par `zTrigger` à la saisie** — c'est une contrainte de forme de la donnée, pas du déroulement, et toute donnée entre par Zod.
- [x] Cas doré n° 1 : **la concentration rompue par les dégâts, entièrement en données**. Le mot « concentration » n'apparaît nulle part dans `triggers.ts`.
- [x] Cas doré n° 2 : deux déclencheurs qui se répondent s'arrêtent avec `chain_depth_exceeded`, message explicite citant la borne, jamais une boucle.
- [x] `triggers.ts` n'importe rien de `next`, `react` ni `@supabase` (lint vert).

**Question tranchée :** l'ordre est une **priorité entière décroissante, égalité départagée par l'ordre de déclaration** — la recommandation, donc pas d'ADR. `Array.prototype.sort` étant stable depuis ES2019, l'ordre de déclaration n'a pas à être porté à la main.

**Interprétation à confirmer.** « Un même déclencheur une fois par chaîne » est ambigu et change le résultat. Lu au pied de la lettre (une fois sur toute la descendance), un ping-pong A→B→A s'arrêterait à la profondeur 3 sans erreur, et le critère du cas doré n° 2 — « s'arrêtent à la profondeur 4 avec une erreur explicite » — deviendrait inatteignable. C'est donc **une fois par événement émis** qui a été implémenté : les deux critères sont alors cohérents, et c'est la profondeur qui borne le ping-pong. À confirmer ou corriger.

**Vérifié par mutation** : `has_condition` forcé à `true` et un jet de sauvegarde toujours réussi font tomber deux tests. La suite mord, elle ne se contente pas de passer.

### V3-A2 — Brancher le vocabulaire d'événements · `M` — **noyau fait le 19 septembre, branchement serveur bloqué**

- [x] La résolution mécanique émet les événements — `src/core/rules/gameEvents.ts`. **`resolveAction` n'existe pas** : le ticket nomme une fonction absente du code. Les vrais points de résolution sont `resolveAttackRoll`, `resolveDamageRoll`, `resolveCheckRoll` (`action.ts`) et `advanceTurn` (`combat.ts`). Trois constructeurs couvrent ceux qui ont un producteur réel aujourd'hui : `eventsForAttack`, `eventsForSave`, `eventsForTurn`. Les douze autres événements du vocabulaire n'ont encore rien qui les produise — leur écrire un constructeur maintenant serait de l'échafaudage.
- [x] Chaque événement porte son contexte, préfixé `event.` et donc lisible par un `ref` de condition (`event.damage`, `event.roll`, `event.ac`, `event.critical`, `event.dc`, `event.round`).
- [x] Un déclencheur qui échoue est journalisé, jamais silencieux, et n'interrompt pas le tour — `TriggerRunResult.failures`, plus une ligne `ECHEC` dans la trace. Une règle maison mal formée ne fige plus une partie ; les effets déjà résolus par ce déclencheur sont conservés, parce qu'ils correspondent à des dés déjà lancés.
- [ ] **Bloqué — le branchement côté serveur attend un magasin de déclencheurs.** `runTriggers` a besoin de la liste des déclencheurs applicables, et rien ne les persiste : aucune table, aucune migration. Câbler `checkRolls.ts` ou le combat aujourd'hui appellerait le moteur avec une liste vide. Cette dépendance n'est mentionnée nulle part dans le lot A ; elle doit être tranchée avant A5 (l'éditeur, qui suppose qu'on puisse enregistrer un déclencheur) et A6 (la conversion du SRD, qui suppose qu'on puisse en charger).

**Choix de conception.** Les résolveurs restent des fonctions pures sans effet de bord : `gameEvents.ts` **traduit** leur résultat en événements, il ne les modifie pas. Leur donner un effet de bord « émetteur » aurait cassé ce qui fait leur valeur — on peut les appeler sans moteur de déclencheurs du tout.

**Un coup émet les deux faces de l'échange** (`damage_dealt` sur l'attaquant, `damage_taken` sur la cible) : c'est ce qui permet au vol de vie et à la concentration de s'accrocher au même coup, et c'est la raison d'être du champ `subject`.

### V3-A3 — Économie d'action · `M`

- [ ] `ActionBudget` — action, bonus, réaction, déplacement, gratuit.
- [ ] Consommé par `resolveAction`, remis à zéro sur `turn_start`.
- [ ] **Signaler, ne pas interdire** : une action hors budget est marquée, jamais bloquée. Les tables dérogent en permanence.
- [ ] Un déclencheur peut accorder ou retirer du budget.

### V3-A4 — État de scène et zones abstraites · `M`

**Le ticket qui débloque tout le solo.** C'est le trou n° 1 d'ADR 0009.

- [ ] `SceneState` : lieu, entités présentes, heure en jeu, éclairage, combat en cours, cinq derniers événements.
- [ ] **Tenu par le moteur, jamais par le modèle.** L'heure avance parce que le code la fait avancer — sur repos, voyage, action longue.
- [ ] Trois zones abstraites : `engaged` / `near` / `far`. Pas de grille tactique.
- [ ] Persisté : reprendre une partie trois semaines plus tard restitue la scène exacte.
- [ ] Aucun champ de `SceneState` n'est écrit depuis une sortie de modèle sans passer par `ai_proposals`.

**Précision de conception, à décider ici** — où vit `SceneState` ? Recommandation : une table `scene_states` avec une ligne par campagne (la scène courante) plus un historique dans `session_events`, plutôt qu'un champ jsonb sur `campaigns`. Raison : la scène change à chaque tour, `campaigns` ne doit pas devenir une table chaude, et l'historique est déjà le rôle du journal.

### V3-A5 — Éditeur de déclencheurs au formulaire · `L`

- [ ] Un formulaire engendré par les schémas Zod, même méthode que les blocs de règles existants.
- [ ] Un bac à sable : « si tel événement survient avec telles données, voici ce qui se passerait » — sans toucher à une vraie partie.
- [ ] Une règle maison créée au formulaire se déclenche en jeu **sans redémarrage**.

### V3-A6 — Convertir les règles SRD qui ont des déclencheurs · `L`

- [ ] Attaque d'opportunité, Second souffle, Rage, Aura de paladin, poison en début de tour, résistances et immunités.
- [ ] **Tenir le compte des règles inexprimables.** À la troisième, rouvrir la question d'une échappatoire — pas avant (spec §3, la règle des trois).

---

# Lot B — La boucle de tour

*Ce lot n'existe dans aucune spec. C'est le chaînon manquant entre le moteur (lot A) et l'écran (lot D).*

### V3-B1 — La barre d'intention · `L`

**Le ticket le plus important de la V3.** Il répond au trou le plus grave d'ADR 0009 : *« rien dans l'écran ne force son usage : la garantie "le modèle ne calcule rien" ne tient que si l'humain pense à toujours fournir le fait ».*

Le principe : le joueur écrit librement, mais **rien ne part au modèle avant que la mécanique soit résolue.**

```
Le joueur écrit :  « je frappe le gobelin avec mon épée »
       ↓
Le moteur propose : ⚔ Attaque · épée longue · cible : Gobelin 2 · action
                    [ Lancer ]   [ ce n'est pas ça ▾ ]
       ↓
Il lance :         d20+5 = 17 vs CA 15 → touché · 1d8+3 = 8 dégâts
                   Gobelin 2 : 7 → −1 PV → meurt
       ↓
Le modèle reçoit ces faits et écrit deux phrases.
```

- [ ] Interprétation de l'intention : d'abord une correspondance déterministe (verbes connus, noms d'actions de la fiche, noms des présents dans la scène). Le modèle n'intervient qu'en repli, et **uniquement pour classer**, jamais pour résoudre.
- [ ] La proposition mécanique est **toujours affichée avant d'être exécutée**, et modifiable en un clic.
- [ ] Une intention non reconnue tombe dans « action libre » : pas de résolution, narration seule — un choix explicite, jamais un contournement silencieux.
- [ ] **Aucun appel au modèle de narration avant que la résolution mécanique ait produit son résultat.** Vérifié par un test, pas par une convention.
- [ ] Le résultat mécanique complet est journalisé en `session_events` (`kind: 'roll'`) avant la narration.

**Pourquoi ce dessin plutôt qu'un simple champ de texte :** l'ADR a montré qu'une case à cocher facultative ne suffit pas. Ici, la mécanique n'est pas une option qu'on peut oublier — c'est le chemin. Et le joueur y gagne : il voit ce que le moteur a compris avant que ça parte, ce qui supprime la frustration du « ce n'est pas ce que je voulais faire ».

### V3-B2 — Le tour, de bout en bout · `L`

- [ ] `playTurn(intention)` : interprète → résout → applique les déclencheurs → met à jour la scène → construit le contexte → appelle le modèle → journalise.
- [ ] **Chaque étape journalise indépendamment.** Si le modèle échoue, le tour a quand même eu lieu : les dés sont lancés, les PV à jour, la scène avancée. Seule la prose manque, avec un bouton « raconter ce tour » pour réessayer.
- [ ] Les PNJ présents sont **recalculés depuis la scène à chaque tour**, jamais une liste figée (trou n° 1 d'ADR 0009 : Ktar commentait une scène qu'il avait quittée).
- [ ] Budget d'entrée : moins de 600 tokens par tour, mesuré et journalisé dans `ai_usage_log`.

### V3-B3 — Le contexte envoyé au modèle · `M`

- [ ] Construit **à chaque tour** depuis l'état courant, jamais un instantané pris au début (trou n° 2 d'ADR 0009).
- [ ] Contenu : état de scène, PNJ présents avec leur bande d'attitude nommée, résultat mécanique du tour, indices de narration (`narrate_hint`), quêtes actives (`listActiveQuestsForWorld` existe déjà et n'attend qu'un appelant).
- [ ] **La bande nommée, jamais le nombre** — « méfiant », pas « −34 ». Les bandes sont déjà définies (`bands.ts`), il ne manque que ce consommateur (critère laissé ouvert dans V2-H1).
- [ ] `known_as` appliqué : un PNJ que le personnage ne connaît pas sous son vrai nom apparaît sous celui qu'il croit (autre critère V2-H1 en attente de ce consommateur).
- [ ] Tout contenu venu de la base est encadré par `fenceUntrustedData` — sans exception, et vérifié par un test qui échoue si un chemin l'oublie.
- [ ] Le contexte est **borné par l'audience de la sortie** (règle absolue 11) : en solo, la sortie est lue par le joueur, donc aucun bloc `gm` n'entre dans le prompt. Un test le vérifie.

### V3-B4 — Varier la narration · `M`

Répond à la répétition verbatim constatée dans le spike (la même réplique trois fois de suite aux tours 14-16).

- [ ] Les *n* dernières narrations entrent dans le contexte avec la consigne explicite de ne pas les répéter.
- [ ] Détection de similarité côté serveur (mesure simple, pas d'embedding) : au-dessus d'un seuil, un seul nouvel essai, puis on garde le meilleur.
- [ ] Bouton **« autrement »** : rejoue la narration du *même* fait mécanique. Les dés ne sont pas relancés — c'est ce qui rend le bouton sûr, et c'est possible parce que le résultat est déjà journalisé.

---

# Lot C — Le monde qui s'écrit

*Le lot demandé : brancher les générateurs sur le moteur, et faire que le wiki se remplisse en jouant.*

## La règle qui gouverne tout le lot : la hiérarchie des sources

Quand le joueur dit « j'entre dans une taverne », qui décide qu'il y a une taverne, et à quoi elle ressemble ?

**Trois sources, dans cet ordre strict, jamais un autre :**

| Rang | Source | Quand |
|---|---|---|
| 1 | **Le wiki existant** | Si une taverne est déjà écrite dans ce lieu, c'est celle-là. Toujours. |
| 2 | **Les générateurs** | Sinon, on tire — vraies tables, vrais dés, résultat déterministe et rejouable |
| 3 | **Le modèle** | Jamais pour un fait. Uniquement pour l'habillage en prose de ce que 1 ou 2 ont produit |

C'est le prolongement direct de « l'IA narre, le code arbitre » (règle absolue 8), appliqué au contenu du monde et pas seulement aux dés. Et c'est ce qui rend le monde **cohérent dans la durée** : revenir trois séances plus tard à la même taverne y retrouve le même tavernier, parce qu'il a été écrit en base au premier passage, pas ré-imaginé à chaque fois.

### V3-C1 — Le pont générateur ↔ moteur · `M`

Aujourd'hui les générateurs sont un outil MJ : on clique, on lit, on décide. En solo, le moteur doit pouvoir les invoquer lui-même.

- [ ] `src/server/services/sceneGeneration.ts` : appeler un outil (`taverne`, `pnj`, `echoppe`, `noms`, `butin`) depuis le moteur, avec les axes de variante déduits de la scène — la richesse et la zone viennent du **lieu courant**, jamais d'un choix du modèle.
- [ ] Le RNG est celui du serveur (`src/server/services/rng.ts`), avec sa graine journalisée : un tirage est **rejouable**, comme n'importe quel jet de dés.
- [ ] Chaque tirage produit un `session_event` (`kind: 'world_update'`) avec la table, le dé et le résultat — la même trace qu'un jet.
- [ ] **Zéro changement au moteur de générateurs.** Si ce ticket demande d'y toucher, c'est que le pont est mal placé.

**Ce que ça donne :** « tu entres à L'Ancre Rouillée. Derrière le comptoir, une elfe taciturne essuie des chopes. » — l'elfe taciturne vient de la table `patrons-tavernes`, tirée sur un d20 réel, pas de l'imagination du modèle.

### V3-C2 — Esquisses de scène · `M`

Le problème : si chaque figurant devient une fiche, le wiki se remplit de bruit en trois séances. Si aucun ne le devient, le monde n'a pas de mémoire.

**La réponse : deux états.** Une **esquisse** vit dans la scène — un nom, deux traits, aucune ligne en base hors du journal. Elle devient une **fiche** quand elle est *ancrée*.

- [ ] Une esquisse porte un identifiant local à la scène, jamais un UUID d'entité — le modèle ne peut donc pas la confondre avec une vraie fiche.
- [ ] Elle peut être nommée et prendre la parole (`npc_reaction` sur une esquisse) : c'est la réponse au trou n° 4 d'ADR 0009, *« aucune voie pour faire parler un personnage ponctuel sans lui donner un identifiant »*.
- [ ] Règle d'ancrage — une esquisse devient une fiche quand **l'une** de ces conditions est vraie : le joueur l'a nommée explicitement, elle a parlé plus de trois fois, elle apparaît dans une deuxième scène, ou le joueur clique « garder ».
- [ ] L'ancrage réutilise `promoteToEntity` tel quel. **Aucun second mécanisme de création de fiche.**
- [ ] Les esquisses non ancrées disparaissent à la fin de la scène — mais restent dans le journal, donc retrouvables.

### V3-C3 — Écrire dans le wiki en jouant · `L`

**Le ticket qui rend le monde vivant.** Toute mutation passe par `ai_proposals` (règle absolue 9) — la table existe, avec exactement les bons `kind` : `create_entity`, `update_entity`, `create_block`, `update_block`, `create_relation`, `set_discovery`.

Mais en solo il n'y a pas de MJ pour valider. D'où la règle :

| Origine de la mutation | Traitement |
|---|---|
| **Produite par le moteur** (tirage de générateur, ancrage d'esquisse, découverte, PV, position, heure) | `auto_applied = true` — c'est déterministe, il n'y a rien à arbitrer |
| **Produite par le modèle** (une phrase de description, un trait de caractère, un lien suggéré) | `pending` — passe par le tiroir de relecture (V3-C5) |

- [ ] `auto_applied` est réellement utilisé (le champ existe depuis la Phase 0 et n'a jamais servi).
- [ ] Toute proposition automatique reste **réversible** : elle porte son `session_event_id`, et « annuler ce tour » défait ce qu'elle a écrit.
- [ ] Un fait mécanique ne crée **jamais** de révision d'entité — PV, position, heure vont dans `session_events` (règle déjà posée dans `specs/wiki-blocs.md` §4.5, ici appliquée au solo).
- [ ] Une modification rédactionnelle (description enrichie, nouveau bloc) crée une révision normale, attribuée à `actor: 'ai'`.
- [ ] Aucune proposition du modèle ne peut viser une entité absente du contexte du tour — l'identifiant vient toujours de l'appelant, jamais de la sortie du modèle (même garde-fou que `writingAssist`).

### V3-C4 — Le wiki qui se découvre · `M`

`entity_discoveries` existe depuis la Phase 0 et **n'a jamais été écrite**. C'est ce ticket.

- [ ] Une entité rencontrée en jeu est marquée découverte, avec son niveau : `mentioned` (on en a entendu parler) → `known` (rencontrée) → `detailed` (fréquentée, fouillée).
- [ ] La marque porte son `source_event_id` : on peut toujours répondre à « où ai-je appris ça ? ».
- [ ] La colonne wiki du mode solo n'affiche **que** ce qui est découvert (critère de `module-joueur-et-solo.md` §C).
- [ ] Une mention en narration promeut à `mentioned`, jamais plus — entendre parler d'un lieu n'ouvre pas sa fiche.
- [ ] Le filtrage est fait **côté serveur, avant l'envoi** (règle absolue 5). Jamais une fiche envoyée puis masquée en CSS.

### V3-C5 — Le tiroir de conséquences · `M`

Rend visible ce que le monde vient d'écrire, sans interrompre le jeu.

- [ ] Après chaque tour, un bandeau discret : « 2 changements dans le monde ▾ ».
- [ ] Déplié : ce qui a été écrit automatiquement (déjà appliqué, avec « annuler ») et ce qui attend une relecture (les propositions du modèle, avec accepter / modifier / rejeter).
- [ ] Rien ne bloque : on peut jouer dix tours sans jamais l'ouvrir. Les propositions en attente s'accumulent et se relisent quand on veut.
- [ ] En fin de séance, un récapitulatif : « le monde a gagné 3 fiches, 7 blocs et 2 relations ». C'est le moment où l'on voit que le wiki grandit tout seul — l'objet même de ce lot.

### V3-C6 — La météo, le temps, le monde qui bouge · `S`

- [ ] Météo par tirage sur une table du monde (un générateur de plus, même mécanisme), pas une invention du modèle.
- [ ] L'heure avance selon l'action : un tour de combat six secondes, une conversation quelques minutes, un voyage des heures. **Tenu par le moteur** (spec du moteur §6).
- [ ] La date en jeu utilise le calendrier du monde (`src/core/calendar`, déjà complet).
- [ ] Le passage jour/nuit change l'éclairage de la scène, qui change les jets — la boucle est bouclée entre le décor et la mécanique.

---

# Lot D — L'interface solo

*Le dessin proposé par l'auteur — trois colonnes, wiki à gauche, jeu au centre, fiche à droite — est déjà celui de `specs/module-joueur-et-solo.md` §B1. Ce lot le confirme et précise ce que la spec laissait dans le vague.*

## Le dessin

```
┌────────────────────────────────────────────────────────────────────────┐
│  L'Ancre Rouillée · Quartier des Quais    ☁ Pluie   Nuit · 23h10   ⏸  │
├──────────────────┬───────────────────────────────┬─────────────────────┤
│ Wiki │PNJ│Règles │                               │  Naivara            │
│                  │  Tu pousses la porte. La      │  ●●●●●●○○○○  11/17  │
│ ▸ Lieux          │  salle sent la bière et le    │  CA 14 · Init +3    │
│   L'Ancre R.  ◆  │  bois mouillé.                │                     │
│   Les Quais      │                               │  Emplacements ●●○○  │
│ ▸ Personnes      │  ┌─ 🎲 Perception ─────────┐  │  Inspiration ✦      │
│   Bram        ◆  │  │ d20+3 = 16 vs DD 12 ✓   │  │                     │
│   ? (l'elfe)  ○  │  └─────────────────────────┘  │  ▸ Actions          │
│ ▸ Factions       │                               │  ▸ Sorts            │
│   La Main…    ◇  │  Derrière le comptoir, une    │  ▸ Sac              │
│                  │  elfe taciturne essuie des    │                     │
│ ── Présents ──   │  chopes sans lever les yeux.  │  ── Le monde ──     │
│ Bram  cordial    │                               │  Jour 14 · Ches     │
│ ? l'elfe  neutre │  ▸ 2 changements dans le monde│  Lune croissante    │
│                  │                               │  Or : 47 pa         │
│                  │ ┌───────────────────────────┐ │  Quête : retrouver  │
│                  │ │ Que fais-tu ?          🎤 │ │  le collier         │
│                  │ └───────────────────────────┘ │                     │
│                  │ ⚔ Attaque · épée · Gobelin 2  │                     │
└──────────────────┴───────────────────────────────┴─────────────────────┘
        ◆ connu     ○ esquisse     ◇ mentionné
```

### V3-D1 — La coquille à trois colonnes · `M`

- [ ] Route `/m/[worldSlug]/solo`, hors de `MondeShell`/`WindowsDesktop` — même décision que la coquille joueur : **le bureau à fenêtres est un paradigme MJ sur grand écran**, pas un écran de jeu.
- [ ] Reprend la peau du wiki public (`BookSkin`, fond par lieu, jetons de design existants), comme le souhaite l'auteur — mais avec la colonne centrale interactive.
- [ ] Les trois colonnes se replient indépendamment. Largeurs mémorisées par personne.
- [ ] **Sous 1024 px, les colonnes deviennent des onglets** (Wiki · Jeu · Fiche), barre en bas, zone du pouce. Même méthode que `PlayerShell`, déjà éprouvée — pas une seconde implémentation.
- [ ] Sous 768 px, l'onglet Jeu est celui qui s'ouvre par défaut, et la saisie reste ancrée en bas de l'écran, au-dessus du clavier virtuel.

### V3-D2 — L'en-tête d'état · `S`

- [ ] Lieu · météo · moment du jour · heure en jeu. **Tous tenus par le moteur** (critère `module-joueur-et-solo.md` §C : *« Lieu et heure viennent du moteur, jamais d'une sortie du modèle »*).
- [ ] Un clic sur le lieu ouvre sa fiche dans la colonne gauche.
- [ ] Bouton pause : suspend la séance, la reprise restitue la scène exacte.

### V3-D3 — La colonne gauche : le monde connu · `M`

- [ ] Trois onglets : **Wiki** (filtré par les découvertes), **Présents** (qui est dans la scène, avec sa bande d'attitude en un mot), **Règles** (recherche dans le ruleset — l'écran de règles existant, en version étroite).
- [ ] **Un marqueur de niveau de découverte sur chaque entrée** : connu, esquisse, mentionné. Le joueur sait ce qui est établi et ce qui vient d'apparaître.
- [ ] Un PNJ présent qui n'est encore qu'une esquisse s'affiche comme tel, avec un bouton « garder » qui l'ancre en fiche (V3-C2).
- [ ] Aucun composant nouveau pour le wiki : c'est le rendu du wiki public, avec un filtre de plus.

### V3-D4 — La colonne centrale : le fil et la saisie · `L`

- [ ] Le fil **est** `session_events` rendu, pas un fil de discussion séparé. Recharger la page le reconstruit à l'identique (critère de la spec).
- [ ] Un rendu par type : narration en prose, action du joueur alignée à droite et discrète, jet en encart compact **avec sa trace**, application de règle repliable, changement du monde en mention discrète.
- [ ] La saisie porte la barre d'intention de V3-B1 — c'est ici qu'elle vit.
- [ ] Saisie vocale par la reconnaissance du navigateur : gratuit, aucun token, une commodité de saisie et rien de plus.
- [ ] Le fil défile automatiquement sauf si l'on a remonté — cas classique et systématiquement raté.
- [ ] **Une région `aria-live` polie** annonce chaque nouveau tour : c'est le seul écran du produit où le contenu arrive sans action de l'utilisateur (voir F‑08 de l'audit).

### V3-D5 — La colonne droite : la fiche et le monde · `M`

- [ ] La fiche jouable existante, en version étroite. **Mêmes composants, aucun code dupliqué** (critère de la spec) — elle est déjà tenue à 375 px depuis la V1.
- [ ] Sous la fiche, un encart « Le monde » : date en jeu, phase de lune, bourse, quête active. Ce sont les données que l'auteur demande, et elles viennent toutes de sources existantes.
- [ ] Les actions de la fiche (attaquer, lancer un sort, se reposer) **alimentent la barre d'intention** au lieu d'agir directement : un seul chemin vers la résolution, jamais deux.

### V3-D6 — Ce qui vient d'où · `S`

*Proposition, au-delà de ce qui a été demandé — à garder ou écarter.*

Chaque élément affiché indique discrètement sa source : **préparé** (écrit par l'auteur avant la partie), **tiré** (générateur, avec le dé au survol), **narré** (le modèle). Trois marqueurs minuscules, sans bruit visuel.

Pourquoi ça vaut la peine : en solo, la première question qui vient est *« est-ce que j'ai inventé ça ou est-ce que c'est canon ? »*. Y répondre d'un coup d'œil est ce qui permet de faire confiance au monde. Et c'est presque gratuit : la source est déjà dans le journal.

---

# Lot E — La mémoire

*À ouvrir seulement après trois séances réellement jouées. Concevoir la mémoire longue avant, c'est deviner.*

### V3-E1 — Résumé de scène · `M`

- [ ] À la fermeture d'une scène, un résumé court, journalisé, relu par le joueur.
- [ ] Les résumés remplacent les tours détaillés dans le contexte des scènes suivantes — c'est ce qui borne les tokens quand la partie dure.

### V3-E2 — RAG sur le wiki · `L`

- [ ] `chunks` et `embedding_queue` existent, l'index HNSW aussi. **La dimension d'embedding doit être figée avant la première indexation** (`SCHEMA.md` §17) — décision à prendre et à consigner en ADR avant d'écrire une ligne.
- [ ] Ce que la recherche remonte entre dans le prompt **encadré par `fenceUntrustedData`**, sans exception.
- [ ] Le contexte reste borné par l'audience (règle 11) : la recherche ne remonte jamais un bloc `gm` dans une sortie lue par le joueur.

### V3-E3 — Le journal de personnage · `S`

- [ ] Un carnet tenu automatiquement : ce que le personnage a appris, promis, refusé. Nourri par le journal, relu par le joueur.
- [ ] Entre dans le contexte du tour à la place des faits bruts — moins de tokens, plus de sens.

---

# Lot F — La partie qui dure

### V3-F1 — Reprendre une partie · `M`

- [ ] Rouvrir une séance trois semaines plus tard restitue la scène, la fiche et le fil à l'identique.
- [ ] Un rappel d'ouverture : « la dernière fois… », engendré depuis les résumés.

### V3-F2 — Annuler un tour · `M`

- [ ] Défaire le dernier tour : les mutations `auto_applied` se retirent par leur `session_event_id`.
- [ ] Le journal reste en ajout seul — annuler écrit un événement d'annulation, n'efface jamais.

### V3-F3 — D'une partie solo à une vraie table · `M`

`module-joueur-et-solo.md` §D le dit : *« une campagne solo a la même forme qu'une campagne classique. Ne pas fermer cette porte. »*

- [ ] Une campagne `solo` devient une campagne ordinaire sans migration de données.
- [ ] Le monde écrit en solo est un monde comme un autre : les fiches, découvertes et relations créées en jouant restent valables avec des amis autour de la table.

# Lot R — La rapidité, et le téléphone

*Ce lot ne construit pas le mode solo. Il reprend les constats de rapidité de [l'audit du 6 septembre](./audit/2026-09-06-synthese.md) restés ouverts, et les ordonne autour d'une question précise : **que se passe-t-il quand un ami ouvre l'application sur un téléphone en 4G ?** Il est parqué ici parce que la V3 est le backlog courant, pas parce qu'il dépend du solo. Il peut avancer à tout moment, en parallèle de n'importe quel autre lot.*

**Où en est-on.** La partie serveur est faite : `P‑01` à `P‑04` et `P‑06` ont été corrigés les 7 et 8 septembre, et l'audit conclut que « les gros leviers habituels — colonnes, index, parallélisme, mémoïsation — sont déjà tirés ». **Ce qui reste pour le téléphone est presque entièrement côté client**, dans le rapport frontend (`F‑14`, `F‑15`, `F‑16`), plus deux chiffres que seul l'auteur peut aller lire (`P‑05`, `P‑07`).

**Mesure de référence, prise le 12 septembre** (`npm run build`, à `claude/gifted-volta-fcw05f`) :

| | Mesuré |
|---|---|
| JS client total | **2,4 Mo** bruts, ~700 Ko gzip, 48 fragments |
| Plus gros fragment | **871 Ko** à lui seul |
| `next/dynamic` + `React.lazy` | **0** dans tout le dépôt |
| `"use client"` | 161 composants sur 181 |

**La contrainte de l'audit est reconduite sur tout le lot : rien ne change pour la personne qui utilise l'application.** Même écran, mêmes fonctions, plus vite. Pas de pagination, pas de fonctionnalité retirée, pas de contenu qui apparaît par morceaux.

---

### V3-R0 — Poser la mesure et le budget · `S` — **mesuré le 12 septembre**

**Avant tout le reste, et c'est la règle du projet** (`campaigns.ts:215` : « à mesurer avant d'optimiser »). `P‑06` a posé un chronomètre **serveur** (`PERF_LOG=1`). Rien ne mesure le **client**, qui est justement là où le téléphone souffre.

- [x] **Mesure faite sur le déploiement réel** (`les-royaumes-oublies.vercel.app`, monde de test `faerun-copie-3`), Chromium en viewport 390 × 844, 4G bridée à 9 Mb/s / 70 ms de latence.

  | Accueil du monde, visite froide | Octets |
  |---|---|
  | **Total** | **2 456 Ko** |
  | dont **une seule image de fond** | **2 071 Ko — 84 %** |
  | dont scripts | 263 Ko |
  | dont polices | 83 Ko |
  | dont feuilles de style + document | 28 Ko |

- [x] **Le JS n'est pas le problème.** 246 à 300 Ko selon la route, après `V3-R1`. Tout le découpage restant (`V3-R3`) se dispute au mieux quelques dizaines de Ko, pendant qu'une image en pèse 2 000.
- [x] **La seconde visite ne transfère que 3 Ko** — le cache navigateur fait son travail. Le coût de 2,4 Mo frappe la **première** visite : exactement celle d'un ami à qui on envoie le lien.
- [x] **Et pourtant cette seconde visite prend encore 4,4 s** pour 3 Ko. Le temps n'est donc pas dans les octets : il est côté serveur.
- [x] **Budget écrit, en deux plafonds** (routes `/joueur/*`), à partir des mesures déjà prises dans ce lot plutôt que d'un chiffre choisi à l'aveugle :

  | Plafond | Valeur | Mesure actuelle la plus haute |
  |---|---|---|
  | JS initial | **350 Ko** | 263 Ko (`/joueur/wiki`, après `V3-R1`/`V3-R3`) |
  | Poids total, visite froide | **700 Ko** | ~620 Ko (image de fond 236 Ko + JS + polices + styles, après `V3-R4a`) |

  Marge volontaire d'environ 15 à 20 % au-dessus du mesuré : assez pour absorber un fond ou un fragment un peu plus lourd sans déclencher une fausse alerte, assez serré pour que le budget en octets totaux — celui qui manquait — attrape une régression d'image que le seul budget JS aurait laissée passer (c'est exactement ce que ce ticket reproche au budget JS seul, ligne au-dessus). Aucun outil de mesure automatique posé ici : la mesure au navigateur de `V3-R0` reste manuelle, ce budget est la référence à laquelle la comparer.

**Réserve de méthode, à ne pas oublier en relisant ces chiffres :** les temps sont mesurés depuis un conteneur qui sort par un proxy, pas depuis un téléphone en France. Les **octets** sont exacts ; les **durées** portent une latence qui n'est pas celle de l'auteur. Un vrai téléphone reste la mesure de référence — mais il ne changera pas le rapport 84 / 11 entre l'image et le JS.

**Sans ce ticket, les cinq suivants sont des paris.** Avec lui, ce sont des mesures.

---

### V3-R1 — Ne plus livrer le bureau à fenêtres au téléphone · `M` — **fait le 12 septembre**

**Le gain le plus net du lot, et le plus spécifiquement smartphone.** Constaté en lisant le code, non relevé tel quel par l'audit.

`AvecWindowsLayer` est monté sur **chaque page de monde** (`app/m/[worldSlug]/layout.tsx:41`). Sous 768 px, il fait `return null` (`AvecWindowsLayer.tsx:79`) — et `WindowsDesktop` se replie sur un simple `Panel` (`WindowsDesktop.tsx:51`). C'est le bon choix produit, déjà tranché : l'audit rappelle qu'« une fenêtre flottante sur 390 px de large est une page en moins bien ».

Mais les imports sont **statiques**. Fermeture transitive mesurée depuis `AvecWindowsLayer.tsx` : **332 fichiers, 55 498 lignes**, dont Tiptap, `@dnd-kit`, `d3-force`, les dix panneaux MJ, les quatre formulaires maison et l'éditeur de fiche complet.

**Autrement dit : le téléphone télécharge et analyse la quasi-totalité du code client de l'application pour afficher `null`.**

- [x] Les quatre contenus passent par `next/dynamic` (`ssr: false`) : `EditEntityForm`, `RuleEntryView`, `MjToolWindowContent`, `RuleToolWindowContent`. `ssr: false` ne perd rien — `avecData` part vide et n'est remplie que par effet, donc aucun des quatre n'était jamais rendu côté serveur.
- [x] **Mesuré** sur la fermeture d'imports statiques du layout de monde, monté sur *toutes* les routes du monde (`import type` exclu, il ne coûte rien à l'exécution) :

  | `app/m/[worldSlug]/layout.tsx` | Avant | Après |
  |---|---|---|
  | Fichiers | 271 | **93** (−66 %) |
  | Lignes | 45 031 | **14 188** (−68 %) |
  | Tiptap, `@dnd-kit`, `d3-force` | les 10 paquets | **aucun** |

- [x] La page de fiche (`f/[entitySlug]`) garde les paquets lourds — elle affiche réellement l'éditeur. C'est le comportement voulu : le découpage retire le poids des routes qui n'en font rien, pas de celles qui en ont besoin.
- [x] Aucun changement visuel : le morceau part quand une fenêtre s'ouvre, et le texte « Chargement... » qui occupe l'intervalle est **celui que le composant affichait déjà** pour `!data`.
> **Note — un critère de ce ticket était mal choisi, et ne sera pas coché.** Il demandait que le plus gros fragment passe sous 871 Ko. Il y reste, et le JS *total* du build **monte** même (2,40 → 3,28 Mo, 48 → 75 fragments) : c'est le comportement normal du découpage, du code partagé se retrouvant dans plusieurs fragments. Le total n'était pas la bonne mesure — ce qui compte est ce qu'**une route** charge, et c'est le tableau ci-dessus. Remplacé par la mesure navigateur de `V3-R0`.
- [x] **Vérifié dans un navigateur le 12 septembre**, sur le déploiement réel, en viewport téléphone : ni Tiptap ni `d3-force` ne sont téléchargés sur `/m/<monde>/regles` ni sur `/m/<monde>/mj/initiative`. Avant ce ticket, le layout de monde les imposait à *toutes* les routes du monde — leur absence est la preuve que le découpage fonctionne en production. L'accueil du monde charge encore `@dnd-kit`, et c'est correct : sa barre latérale réordonne l'arbre des entités.
- [x] Rendu mobile vérifié par capture : panneau simple, pas de fenêtre flottante, volet de dés en place. Rien de cassé.

**Le piège :** `useDesktopWindowsState` et les contextes (`DiceRollProvider`, `ChatUnreadProvider`) doivent rester montés — c'est exactement ce que le commentaire d'`AppShell.tsx` explique avoir déjà coûté un bug (« une fiche de personnage ouverte en fenêtre secondaire perdait `useDiceRoll` »). Découper le **contenu**, jamais les fournisseurs de contexte.

---

### V3-R2 — Le premier rendu ne suppose plus un grand écran · `S` — **fait le 12 septembre**

`WindowsDesktop.tsx:26` et `AvecWindowsLayer.tsx:60` font tous les deux `useState(false)` puis résolvent la largeur dans un `useEffect`.

Conséquence sur téléphone : le premier rendu client **suppose un grand écran**, monte l'arbre du bureau à fenêtres, puis le jette quand l'effet s'exécute. Du travail intégralement perdu, sur l'appareil le plus lent, au moment le plus coûteux — plus un décalage de mise en page.

**Le projet a déjà résolu ce problème, au bon endroit :** `DiceRollPanel.tsx:143-171` utilise `useSyncExternalStore` + `window.matchMedia`, avec un commentaire qui explique précisément pourquoi ce n'est pas `useState` + `useEffect`. Il y a un précédent maison à suivre, pas une décision à prendre.

- [x] `WindowsDesktop` et `AvecWindowsLayer` adoptent le même `useSyncExternalStore` + `matchMedia` que `DiceRollPanel`. Le mécanisme est extrait dans `components/shell/useMatchMedia.ts` ; `DiceRollPanel` l'utilise aussi, ses 17 lignes de mécanique en double supprimées.
- [x] Le seuil du bureau à fenêtres vit à **un seul endroit** : `WINDOWS_MOBILE_QUERY`. Il était dupliqué en dur (`MOBILE_BREAKPOINT = 768`) dans deux fichiers qui doivent impérativement basculer ensemble.
- [x] **Les deux seuils divergents ne sont pas un défaut — le ticket se trompait.** 768 px (bureau à fenêtres) et 639 px (volet de dés) répondent à deux questions différentes : « y a-t-il la place pour des fenêtres flottantes ? » et « le volet s'ouvre-t-il sur le côté ou en bulle ? ». Les aligner aurait changé le comportement du volet entre 640 et 767 px — ce que ce lot s'interdit. **Mécanisme unifié, seuils laissés distincts**, et la raison est écrite dans `DiceRollPanel.tsx` pour que personne ne « corrige » l'écart plus tard.
- [x] Le premier rendu **client** a la bonne valeur : plus de `useState(false)` suivi d'un `useEffect`, donc plus de montage-puis-rejet de l'arbre du bureau à fenêtres sur téléphone.
> **Note — comportement assumé, pas une tâche restante.** Le rendu **serveur** suppose toujours un grand écran : `getServerSnapshot` renvoie `false`, parce que le serveur ne peut pas connaître la largeur de l'écran. C'est le même choix que `DiceRollPanel` faisait déjà avant ce ticket. React réconcilie avec la vraie valeur dès l'hydratation, sans passer par un effet — ce que ce ticket corrigeait était le rendu **client**, et il est corrigé. Il n'y a rien de plus à faire ici sans rendre le serveur conscient de l'écran, ce qui n'est pas possible.
- [x] `npm run typecheck`, `npm run lint`, `npm run test` (778 passés) et `npm run build` verts.

**Cette prédiction du ticket s'est révélée fausse, et c'est tant mieux.** Il annonçait que `R2` conditionnait `R1` — « un import dynamique déclenché par un booléen qui commence toujours à `false` chargerait quand même le code sur téléphone ». À l'implémentation, `R1` n'a pas eu besoin d'être branché sur `isMobile` du tout : les quatre contenus ne sont rendus que dans la boucle sur les fenêtres **ouvertes**, donc l'import différé se déclenche à l'ouverture d'une fenêtre, sur n'importe quel appareil. C'est plus simple et plus robuste qu'un découpage conditionné à la largeur de l'écran — qui, lui, aurait bien dépendu de `R2`. Les deux tickets restent justes séparément ; leur dépendance, non.

---

### V3-R3 — Découper les éditeurs de blocs · `M` — *audit `F‑14`* — **fait le 12 septembre**

`components/blocks/EntityBlocks.tsx` : 977 lignes, 54 imports, **les 19 éditeurs `*BlockEditor` plus `PlayableCharacterSheet` importés statiquement** (lignes 21‑41 ; l'audit annonçait 21 éditeurs, le décompte exact est de 19 + 1). Fermeture transitive mesurée : **272 fichiers, 44 048 lignes**.

Ouvrir une fiche qui ne contient qu'un bloc texte télécharge le canevas de carte, le moteur de graphe `d3-force`, la fiche de créature et l'assistant de création de personnage.

L'audit souligne le point qui compte le plus : **le coût augmente à chaque nouveau type de bloc.** « Le vingt-deuxième s'ajoutera au paquet initial comme les vingt et un précédents. » — le décompte diffère, le mécanisme est le bon. C'est une des rares optimisations dont le gain grandit avec le projet.

- [x] Les 21 vues (19 éditeurs, la fiche de créature, la fiche jouable) passent par `next/dynamic`. Le `switch` de `BlockDataEditor` est **inchangé** : tout le découpage tient dans les déclarations d'import — un seul endroit à tenir à jour, comme demandé.
- [x] **Vérifié en production, en viewport téléphone.** Deux fiches du même monde ne pèsent plus pareil, ce qui était impossible avant :

  | Route | JS | Bibliothèques lourdes chargées |
  |---|---|---|
  | `/f/11` (a des blocs texte) | 542 Ko | Tiptap — **légitime, elle l'affiche** |
  | `/f/2` (carte, sans bloc texte) | 401 Ko | **aucune** |
  | `/joueur/wiki` | 263 Ko | **aucune** |

  `d3-force` a disparu de **toutes** les routes de fiche. Avant, `EntityBlocks` l'imposait à chacune.

- [x] Plus gros fragment du build : **871 Ko → 439 Ko**. Le critère que `V3-R1` avait dû écarter comme mal choisi se trouve atteint ici, pour la bonne raison.
- [x] Comportement d'édition intact, vérifié sur le déploiement : l'éditeur ProseMirror se monte, la zone est bien `contenteditable`, aucune erreur JS en console. (Le seul 404 observé est `/api/entities/<id>/portrait` pour une entité sans portrait — comportement préexistant, sans rapport.)
- [x] Ajouter un type de bloc de plus n'augmentera plus le paquet initial : c'est la propriété structurelle que ce ticket visait, et elle est acquise.

> **Note — l'état de chargement à hauteur réservée n'a pas lieu d'être, et c'est mieux ainsi.** Le ticket demandait un placeholder par éditeur pour éviter le saut de mise en page. En n'utilisant **pas** `ssr: false` (contrairement à `V3-R1`), ces vues restent rendues côté serveur : le balisage arrive complet dans le HTML, la mise en page est juste dès le premier pixel, et seul le JS d'hydratation est différé. Un placeholder aurait *créé* le saut qu'il était censé éviter. Un bloc replié (`isCollapsed`) ne rend rien, donc ne télécharge rien non plus.

**Un second chemin, trouvé en vérifiant plutôt qu'en supposant.** Après le découpage d'`EntityBlocks`, `d3-force` restait sur la route **wiki joueur**. Cause : `PublicBlockView.tsx` est un composant **serveur** qui importe des composants clients — leur JS entre donc dans le paquet de la route même sans être rendu. Des sept vues publiques, six pèsent moins de 1 800 lignes et rien de tiers ; seule `PublicRelationsGraphBlock` tire `d3-force`. Elle seule est passée en `dynamic` ; **les six autres restent en import statique**, parce que les découper coûterait un aller-retour pour quelques centaines de lignes. On ne découpe que ce qui pèse.

> **Observation hors périmètre, à traiter ailleurs.** La page de partage public (`/partage/<jeton>/<fiche>`) embarque `@dnd-kit` par la chaîne `BookSkin.tsx` → `EntityTree.tsx`, alors qu'un visiteur anonyme ne peut rien réordonner. Pas touché ici : ce ticket porte sur les vues de bloc, et `EntityTree` est la barre latérale. À ouvrir comme ticket propre si une mesure le désigne.

---

### V3-R4 — Les images à la taille du téléphone · `M` — *audit `F‑15`* — **devenu le ticket n° 1 du lot**

> **Réécrit le 12 septembre, après la mesure de `V3-R0`.** Ce ticket visait les images d'entité et les cartes. La mesure sur le déploiement réel a montré que le poste dominant est ailleurs, et qu'il est bien plus gros : **l'image de fond de l'application, 2 071 Ko à elle seule, 84 % du poids d'une page.** Le reste du ticket est inchangé et reste valable, mais il passe après.

#### R4a — Le fond de l'application pèse 2 Mo · `S` — **fait le 12 septembre**

`public/backgrounds/Artwork_C.png` : **2 120 673 octets pour une image de 1456 × 763**. Huit autres fonds l'accompagnent, entre 1,4 et 2,3 Mo — **~17 Mo dans `public/`**. Ils sont servis bruts, et l'en-tête de Vercel pour `public/` est `cache-control: public, max-age=0, must-revalidate` : chaque navigation redemande l'image, ne serait-ce que pour s'entendre répondre 304 — un aller-retour avant de peindre, sur un réseau où l'aller-retour est cher.

**Attention : la pleine qualité est un choix délibéré, pas un oubli.** `builtinBackgrounds.ts` le dit : *« servi directement depuis public/backgrounds/ — jamais retraité, pleine qualité (retour utilisateur : la miniature seule pixelisait le fond quand le flou baisse) »*. Ce ticket **ne remet pas ce choix en cause**. Il observe seulement que la décision était « ne pas utiliser la vignette comme fond », et non « expédier 2 Mo de PNG » : à 1456 × 763, un AVIF ou un WebP de qualité visuellement équivalente pèse 150 à 400 Ko. La contrainte de l'auteur est tenue, le poids divisé par cinq à dix.

- [x] Les neuf fonds convertis **en WebP** (et non AVIF — voir plus bas), qualité 90, **dimensions inchangées**, alpha retiré car intégralement opaque (255/255, vérifié).

  | | Avant | Après |
  |---|---|---|
  | `Artwork_C` (le fond par défaut) | 2 071 Ko | **236 Ko** |
  | Les neuf fonds | 16,42 Mo | **1,93 Mo** (×8,5) |

- [x] **La contrainte de qualité est tenue, pas contournée.** Écart au PNG d'origine mesuré à **2,4 de RMSE**, et vérifié à l'œil sur un recadrage 1:1 **sans aucun flou** puis sur le rendu réel avec `--bg-blur: 0` et le voile retiré : traits fins, dégradés et points lumineux intacts, aucun artefact. Le choix d'origine portait sur « ne pas utiliser la vignette comme fond », jamais sur le format de fichier.
- [x] Cache-Control posé sur `/backgrounds/` via `headers()`.
- [x] **Mesuré avant/après** sur le déploiement réel, même protocole que `V3-R0` :

  | Accueil du monde, visite froide | Avant | Après |
  |---|---|---|
  | **Total** | 2 456 Ko | **619 Ko** (×4) |
  | dont images | 2 071 Ko | **236 Ko** |
  | dont scripts | 263 Ko | 263 Ko |

> **Note — une option écartée, délibérément.** Servir une taille adaptée à l'écran (un fond de 1456 px sur un téléphone de 390 px transfère encore trop de pixels) demanderait `image-set()` ou des requêtes média depuis une `background-image` CSS. De la complexité pour ~150 Ko, quand ce ticket vient d'en gagner 1 835. À rouvrir seulement si une mesure le désigne — pas avant.

**Deux écarts au ticket, assumés et expliqués :**

**WebP plutôt qu'AVIF.** L'AVIF descendait à 101 Ko contre 236 — 135 Ko de mieux. Mais le fond est une `background-image` CSS injectée via `--bg-image` depuis trois endroits distincts ; un repli AVIF → WebP y demande `image-set()` avec `type()`, que Safari ne comprend qu'à partir de 17, et dont l'échec n'est pas gracieux : la déclaration entière est invalidée, donc **plus de fond du tout**. WebP est compris partout depuis 2020, tient dans une seule URL, et capture déjà 93 % du gain disponible. Le format n'est pas le sujet une fois qu'on est passé de 2 071 à 236 Ko.

**`immutable` écarté.** Le ticket demandait `max-age=31536000, immutable`. Ces fichiers ne portent pas d'empreinte dans leur nom : remplacer une illustration en gardant son nom figerait l'ancienne version **un an** chez tous les visiteurs déjà venus, sans recours. Posé à la place : `max-age=2592000, stale-while-revalidate=31536000` — 30 jours de fraîcheur couvrent largement une partie ou une campagne, donc l'aller-retour de revalidation disparaît tout autant, et la revalidation en arrière-plan sert l'ancienne image immédiatement tout en allant chercher la nouvelle. Même gain, sans le mode d'échec.

**Le gain annoncé était juste — et le constat qui l'accompagne l'est moins.** La page est bien passée de 2 456 à 619 Ko, comme prévu. Mais **le temps de chargement, lui, n'a pas bougé** : 5 336 ms contre 5 285 ms avant, sur la même 4G bridée. Quatre fois moins d'octets, le même temps.

C'est la leçon la plus utile de ce lot, et elle mérite d'être écrite ici plutôt que découverte deux fois : **sur ce produit, le poids n'est plus le facteur limitant.** Une seconde visite transfère 2 Ko et prend encore 4,7 s. Tout le temps restant est dans les allers-retours serveur — les 9 vagues de rendu de l'audit. `V3-R1`, `V3-R3` et `V3-R4` réunis ne le réduiront jamais.

Cela ne retire rien à ce ticket : 1,8 Mo en moins, c'est de la donnée mobile épargnée à chaque ami qui découvre l'application, et un budget qui ne se dégradera plus. Mais **la suite du lot est côté serveur, pas côté client** — `V3-R6` d'abord.

#### R4b — Les images d'entité et les cartes · `M` — **fait le 12 septembre, sur une base différente de celle du ticket**

Un seul `next/image` dans tout le projet, contre **11 balises `<img>` brutes**, chacune avec son `eslint-disable`. Aucune section `images` dans `next.config.ts`.

Le chiffre qui rend ce ticket urgent est déjà dans le dépôt : le commentaire de `next.config.ts` note qu'**une carte réelle pèse ~20 Mo** (plafond de téléversement à 25 Mo). Sans redimensionnement, ces 20 Mo partent en pleine résolution vers le téléphone — pour être affichés sur 390 px de large.

La justification écrite dans le code (« images dynamiques dont Next ne connaît pas l'URL à la compilation ») est exacte mais incomplète : `next/image` accepte une URL dynamique dès que le domaine est déclaré.

> **Le diagnostic de l'audit était faux sur la cause, et ce ticket a été refait sur cette base.** `F‑15` concluait qu'il « manque la déclaration du domaine dans `next.config.ts` ». En réalité, `next/image` est **structurellement inutilisable** sur ces images : leur autorisation est résolue **par visiteur** (cookies de session → RLS `assets_select`), et l'optimiseur de Next récupère la source côté serveur, sans ces cookies. Toutes les images casseraient — et lui ouvrir un accès plus large mettrait en cache **par URL** un résultat vérifié pour un seul visiteur, ce qu'interdit la règle absolue n° 5. Écrit dans **`docs/adr/0021`**, pour que le prochain audit ne repose pas la question.

- [x] **Décision d'architecture écrite** : `docs/adr/0021-pas-de-next-image-sur-les-images-d-entite.md`. Les `<img>` et leurs `eslint-disable` restent, désormais justifiés par un ADR plutôt que par une note de ligne.
- [x] **Le redimensionnement et le format moderne existaient déjà**, faits au bon endroit : `uploadAsset` ré-encode tout en **WebP qualité 85** et redimensionne selon `maxDimension`. L'optimisation n'était pas absente, elle était faite une fois au téléversement plutôt qu'à chaque requête — ce qui est mieux.
- [x] **Le saut de mise en page n'existait quasiment pas.** Vérifié image par image : **7 des 10** `<img>` réservaient déjà leur place (`h-full w-full` dans un parent dimensionné, `aspect-[3/4]` avec largeur explicite, ou `width`/`height` calculés depuis `/api/assets/[id]/meta`). L'affirmation générale de l'audit ne s'appliquait pas à elles.
- [x] **Chargement différé ajouté** là où il est juste — six images qui peuvent être hors écran : les deux blocs `image` (vue publique, vue joueur), les portraits de l'arbre généalogique, ceux du réseau de relations, ceux des punaises de carte, et l'aperçu de l'éditeur. Une fiche à dix illustrations, un arbre à trente nœuds ou une carte à vingt punaises ne déclenchent plus autant de requêtes d'un coup. **Pas** appliqué au portrait de tête, au canevas de carte ni à l'aperçu de téléversement : ils sont l'objet de la page, les différer serait une régression.
- [x] **Pleine résolution partout, conformément à la décision de l'auteur du 12 septembre.** `MapCanvas` fait déjà mieux que ce que le ticket imaginait : une image d'attente puis la pleine résolution en fondu (`placeholderUrl` → `imageUrl`, `fullLoaded`). Rien à changer.
- [x] `SIGNED_URL_CACHE_HEADER` (`P‑03a`) toujours appliqué — vérifié dans le code des routes, pas supposé.

**Ce qui reste, et qui demande une décision, pas du code.** Les trois `<img>` qui sautent encore sont les blocs `image`. Leur `url` peut être une **adresse externe collée** autant qu'un asset téléversé, et `zImageBlockData` ne stocke aucune dimension : impossible de réserver l'espace sans connaître le rapport de l'image. Le corriger demande d'ajouter des dimensions au schéma du bloc — un changement de forme de donnée. `CLAUDE.md` dit de s'arrêter et de demander dans ce cas : **c'est fait, la question est posée.**

**Un point à trancher, pas à coder d'office :** `MapCanvas` est le seul endroit où la pleine résolution est parfois légitime (on zoome dans une carte). Décider — et écrire la décision — si la carte reçoit un traitement à part. C'est le seul endroit du lot où « rien ne change pour l'utilisateur » peut entrer en tension avec le gain.

---

### V3-R5 — Supprimer les cascades de chargement · `L` — *audit `F‑16`* — **fait le 12 septembre — et c'est lui qui a fait bouger le temps**

**38 composants** font un `fetch` dans un `useEffect`. Le déroulement est toujours le même : le serveur rend la page → le navigateur télécharge le JS → React monte → l'effet part → la requête voyage → le contenu apparaît. Quatre allers-retours là où un seul suffirait.

Sur un téléphone en 4G, chaque étape coûte bien plus que sur la machine de développement — c'est le constat qui se dégrade le plus vite quand on quitte le bureau.

L'audit le dit lui-même : **pas en une fois.** Page par page, en commençant par les plus ouvertes.

> **La cascade n'était pas celle que `F‑16` décrivait.** L'audit comptait 38 composants faisant un `fetch` dans un `useEffect` et en concluait au chargement en cascade. Mesuré sur le déploiement réel : une fiche n'en déclenche que **trois** (radio, messages non lus, jets de dés), tous des widgets de coquille, aucun contenu principal. `F‑16` comptait des composants, pas ce qui s'exécute — les 35 autres sont des panneaux ouverts à la demande.
>
> **La vraie cascade était le préchargement de Next.** Ouvrir une page de monde déclenchait **45 à 49 requêtes `_rsc`** pour 23 routes distinctes. Ces routes sont dynamiques : *chaque préchargement est un rendu serveur complet, avec ses requêtes en base*. Ouvrir une page en déclenchait quarante-cinq. C'est ce qui expliquait qu'une seconde visite transfère 2 Ko et prenne quand même 4,4 s.

- [x] **Cause trouvée, et elle rendait le préchargement absurde :** `<Link>` précharge par défaut tout lien entrant dans le champ de vision, et `EntityTree` en pose un par entité. Or **un clic normal sur une entité ne navigue pas** — `useOpenEntityLink` fait `preventDefault()` et ouvre une fenêtre (ADR‑0006). Le `href` n'existe que pour le ctrl-clic, qui ouvre un onglet neuf et n'utilise donc pas ce cache. On préchargeait 27 routes vers lesquelles on ne va jamais.
- [x] `prefetch={false}` sur `EntityTree`, **partagé par les trois barres latérales** (monde, joueur, peau « livre ») — un seul endroit.
- [x] **Mesuré avant/après sur le déploiement réel** (la mesure `PERF_LOG` que le ticket prévoyait est restée inutile : le navigateur donne directement le bon chiffre) :

  | | Avant | Après |
  |---|---|---|
  | Préchargements, accueil du monde | 45 | **9** |
  | Préchargements, fiche d'entité | 49 | **14** |
  | Routes distinctes préchargées | 23 | **5** |

- [x] **Et le temps a enfin bougé.** Visite froide en 4G bridée, médiane sur 5 mesures : **3 304 ms** (2 818 – 3 417) contre **5 285 ms** avant le lot. Seconde visite : 4 731 → **2 464 ms**.
- [x] Le contenu principal de la fiche était **déjà** rendu côté serveur — le critère d'origine était donc satisfait avant ce ticket, ce que seule la mesure pouvait dire.
- [x] `useCachedGet` intact, et les corrections de `F‑03` avec lui : rien n'a été touché de ce côté.

> **Observation laissée ouverte.** La coquille joueur précharge encore ses 8 routes (15 requêtes) — les six onglets de sa barre du bas. Contrairement à l'arbre d'entités, ce sont de **vraies destinations** entre lesquelles un joueur bascule sans cesse, donc le préchargement s'y défend. À rouvrir seulement si une mesure sur un vrai téléphone le désigne.

**Ne pas ouvrir ce ticket avant que `V3-R1` et `V3-R3` soient faits.** C'est le plus long du lot et le moins rentable au Ko ; les deux premiers rendent une partie de son gain sans toucher à la forme des pages.

---

### V3-R6 — Les deux chiffres que seul l'auteur peut lire · `S` — *audit `P‑05`, `P‑07`* — **`P‑05` refermé le 12 septembre**

Ce ticket ne demande presque pas de code. Il demande d'ouvrir deux tableaux de bord.

**La région** (`P‑05`). `vercel.json` fixe `"regions": ["dub1"]` (Dublin) ; la région du projet Supabase n'apparaît nulle part dans le dépôt. Si les deux diffèrent, **chacune des 9 vagues de rendu paie un aller-retour transatlantique** — et aucune optimisation de code ne rattrapera ça. L'audit est net : « changer une ligne de `vercel.json` produirait plus de gain que tous les autres points de cette section réunis ». C'est doublement vrai sur téléphone, où la latence est déjà dégradée avant même d'atteindre Vercel.

- [x] **Région lue : la base est en West EU (Ireland), `eu-west-1`.** Or la région Vercel `dub1` **est** `eu-west-1` : les fonctions et la base sont déjà dans le même centre de données. **`P‑05` se referme — il n'y avait rien à corriger.** Le réglage était bon depuis le début.
- [x] La raison est écrite dans `vercel.json` lui-même, pas seulement ici : c'est le fichier qu'on ouvre quand on se pose la question.

> **Un piège, rencontré pour de vrai, et qui vaut d'être écrit.** Le réglage « Function Region » du tableau de bord Vercel est **écrasé par `vercel.json`** dès que ce fichier déclare `regions` — le tableau de bord l'affiche d'ailleurs comme *« Overridden »*. Le changer dans l'interface ne produit donc aucun effet tant que le fichier dit autre chose. Le fichier fait foi.
>
> **Et une erreur commise en traitant ce ticket, gardée ici plutôt qu'effacée.** `cdg1` a été pris pour la région Supabase alors que c'est un code de région **Vercel** ; `vercel.json` est passé à `cdg1` (Paris) avant que le tableau de bord Supabase ne montre `eu-west-1` (Dublin). Cela **éloignait** les fonctions de la base au lieu de les rapprocher — l'inverse exact du but de `P‑05`. Corrigé en revenant à `dub1`. La leçon est celle que l'audit répète partout : **lire le chiffre à la source avant d'agir dessus**, y compris quand quelqu'un vous le donne de mémoire.

**Le coût des fonctions RLS** (`P‑07`). Dix minutes dans Reports → Query Performance (`pg_stat_statements`).

- [x] **Relevé fait, deux fois.** Le premier (cumulé depuis des mois) était inexploitable : 11 767 `INSERT INTO users` et 11 634 `DELETE FROM users` — du développement, pas de l'usage. Le second, après `pg_stat_statements_reset()` et quelques minutes d'usage normal sur une instance au repos, est net.
- [x] **`P‑07` est confirmé, et il est plus étroit que l'audit ne le craignait.** Ce n'est pas « la RLS coûte par ligne » en général :

  | Table | Moyenne | Lignes rendues |
  |---|---|---|
  | `ruleset_entries` | **421 ms** | 1 |
  | `ruleset_entry_translations` | **262 ms** | 1 |
  | `campaign_members` | 10,2 ms | 1 |
  | `worlds` | 9,3 ms | 1 |
  | `entity_revisions` | 6,7 ms | 1 |

  Les autres politiques RLS répondent en 10 ms. **Le coût est isolé aux tables de règles**, dont les deux politiques passent par `app.can_read_ruleset`.

- [x] **Cause trouvée, et ce n'est pas la logique de visibilité :** `can_read_ruleset` cherche le ruleset dans `campaigns` et `worlds` par une colonne de clé étrangère, et **ni `campaigns.ruleset_id` ni `worlds.default_ruleset_id` n'a jamais porté d'index** — Postgres n'en crée jamais côté enfant. Chaque évaluation faisait deux balayages complets. Et comme un prédicat RLS est évalué **avant** les filtres de l'utilisateur, le coût se paie par ligne *parcourue* : une lecture qui ne rend qu'un sort traverse quand même le SRD en appelant la fonction à chaque entrée.
- [x] Migration écrite : `supabase/migrations/20260912203000_ruleset_lookup_indexes.sql`. **Elle n'ajoute que deux index** — aucune politique, aucune fonction, aucune donnée touchée. La barrière de sécurité reste identique, elle devient praticable. C'est la moins risquée des deux pistes que l'audit envisageait ; l'autre (restructurer la logique de visibilité) reste écartée.
- [ ] **À appliquer par l'auteur** (`supabase db push`), puis remesurer avec le même protocole. Attendu : `ruleset_entries` rejoint l'ordre de grandeur des autres tables. Si ce n'est pas le cas, ne pas insister sur les index — refaire un `EXPLAIN ANALYZE` et rouvrir.
- [ ] `P‑08` (listes sans borne) ne se rouvre **que** si une mesure le désigne. Rien ici ne le fait.

---

### V3-R7 — Deux boucles qui rechargent les règles une par une · `M` — **fait le 13 septembre**

*Ouvert le 12 septembre, à partir de `pg_stat_statements` — pas de l'audit, qui ne l'avait pas vu.*

**Le chiffre.** `ruleset_entries` en lecture unitaire : **39 871 appels** pour une requête qui renvoie **une seule ligne**, plus trois variantes de la même table dans le même relevé. À elles quatre, elles représentent l'essentiel du temps base mesuré.

**Ce que ce chiffre n'est pas.** La moyenne relevée (445 ms) ne dit **pas** que la requête est mal écrite : `unique (ruleset_id, entry_key)` fournit exactement l'index qu'elle utilise, c'est une recherche directe. Cette moyenne reflète très probablement la **contention** sur une instance `t4g.nano` saturée par le volume de requêtes d'avant `V3-R5`. Ce ticket ne porte donc pas sur la latence d'une requête, mais sur leur **nombre**.

**La cause, trouvée en lisant le code.** `src/server/services/rules.ts`, deux endroits :

- `resolveOutgoingRefs` (≈ ligne 413)
- `resolveEntryNames` (≈ ligne 701)

Les deux suivent le même motif : une requête groupée par `listRulesetEntriesByKeys`, **puis une boucle séquentielle** sur les clés absentes, appelant `findEntryInRulesetChain` pour chacune.

Or `listRulesetEntriesByKeys` n'interroge **qu'un seul ruleset** — jamais la chaîne parente. Donc pour un monde dont le ruleset est une variante (le cas prévu par le modèle : `parent_ruleset_id`, règle absolue n° 18), **toutes** les clés qui vivent dans le SRD officiel manquent au premier tir et tombent dans la boucle. Et `findEntryInRulesetChain` fait **deux requêtes par niveau de chaîne**, en série : `getRulesetEntryByKey` puis `getRulesetById`.

Une fiche de personnage citant trente sorts et dons, sur un monde à ruleset dérivé, c'est donc trente clés × deux requêtes × le nombre de niveaux — là où une seule requête suffirait.

**Le correctif est déjà écrit, à côté.** `getRulesetEntriesByKeysAcrossRulesets` (`src/server/repos/rules.ts`) fait exactement ça : **toutes les clés × toute la chaîne, en une requête**. Son propre commentaire dit qu'elle a été ajoutée pendant l'audit pour supprimer ce motif dans `fetchEquipmentBlocks`. Ces deux consommateurs-ci n'ont simplement jamais été convertis.

C'est le même enseignement que `P‑01` : *la primitive existait, il manquait de vérifier qui d'autre en avait besoin.*

- [x] `resolveOutgoingRefs` et `resolveEntryNames` résolvent leurs clés par `getRulesetEntriesByKeysAcrossRulesets`, sur la chaîne déjà résolue (`walkRulesetChain`, mémoïsée) plutôt que sur le seul ruleset du monde. Extrait dans une fonction partagée, `entriesFromChainByKeys` (juste après `entryFromChainByKey`, dont elle est la version "plusieurs clés") : une requête au lieu d'une par clé absente.
- [x] La boucle de repli ne subsiste que pour les fiches **maison** (`resolveHomebrewEntryDisplay`), qui ne vivent pas dans `ruleset_entries` — c'est le seul cas qu'un tir groupé ne peut pas couvrir. Rien d'autre n'est resté séquentiel.
- [x] **Le résultat ne change pas, y compris l'ordre de priorité de la chaîne** : `entriesFromChainByKeys` reprend exactement l'algorithme d'`entryFromChainByKey` (parcours de `chain` feuille → racine sur les candidats renvoyés par la requête groupée), pas une nouvelle logique.
- [x] Un test couvre le cas qui casse tout le reste (`rules.chainPriority.integration.test.ts`, base réelle) : un ruleset parent et un enfant, une clé présente **uniquement chez le parent** (retombe dessus) et une clé **surchargée** dans l'enfant (la version de l'enfant gagne) — les deux vérifiées dans le même appel à `entriesFromChainByKeys`.
- [x] `findEntryInRulesetChain` reste pour ses appelants unitaires légitimes (`resolveEntryDetail`, `resolveHomebrewEntryDisplay`, `characterActions.ts`) — ni supprimée ni touchée.
- [ ] **Mesure avant/après**, sur `pg_stat_statements` remis à zéro : le nombre d'appels à la lecture unitaire doit s'effondrer. Pas encore fait — ça demande quelques minutes d'usage réel de l'application (même protocole que `P‑07`), pas une mesure qu'on peut produire depuis une session de développement sans trafic. **À faire par l'auteur après ce ticket** : `pg_stat_statements_reset()`, naviguer normalement quelques minutes (fiches de personnage, pages de classe/sous-classe), puis comparer le nombre d'appels sur `ruleset_entries` au chiffre de référence (39 871). La correction elle-même ne dépend pas de cette mesure : par construction, `entriesFromChainByKeys` fait exactement **une** requête par appel, quel que soit le nombre de clés ou de niveaux de chaîne — c'est une propriété du code, pas un résultat à confirmer statistiquement.

**Pourquoi `M` et pas `S` :** la résolution de règles est le cœur du projet, et l'ordre de priorité de la chaîne est ce qui fait qu'une variante surcharge correctement une base officielle. Le correctif est mécanique ; sa vérification ne l'est pas.

**À ne pas faire dans ce ticket.** Ne pas toucher aux politiques RLS de `ruleset_entries` : rien dans la mesure ne les désigne, et l'audit est formel — ces politiques sont la barrière de sécurité, on ne les réécrit pas sur une intuition (`P‑07`). Non touchées.

**Vérifié** : `npm run typecheck && npm run lint` passent, `npm run test:core` (760 tests) passe. Le nouveau test d'intégration passe seul et aux côtés des tests d'intégration existants sur `rules.ts` (`rules.homebrewReference`, `resolvedRuleset`). La suite d'intégration complète (`npm run test`) reste intermittente sous charge contre la base de dev distante partagée (limite de débit de l'API Auth, expirations à 5 s) — même constat environnemental que documenté ailleurs dans ce dépôt (`docs/BACKLOG_V2.md`, lot H), sans rapport avec ce ticket : aucun des échecs ne touche `rules.ts` ni les fichiers modifiés ici.

---

### Ordre de traitement

| Ordre | Ticket | Pourquoi là |
|---|---|---|
| 1 | **V3-R0** | Sans mesure, tout le reste est un pari |
| ~~1 bis~~ | **V3-R6** | **`P‑05` refermé le 12 septembre : la base et les fonctions étaient déjà dans le même centre de données.** Reste `P‑07` — dix minutes dans `pg_stat_statements`, chez l'auteur |
| ~~2~~ | ~~**V3-R2** puis **V3-R1**~~ | **Faits le 12 septembre** — le layout de monde perd 68 % de son graphe d'imports et les trois bibliothèques lourdes |
| ~~3~~ | ~~**V3-R3**~~ | **Fait le 12 septembre — plus gros fragment 871 → 439 Ko, et deux fiches ne pèsent plus pareil selon leurs blocs** |
| ~~1~~ | ~~**V3-R4a**~~ | **Fait le 12 septembre — 2 456 Ko → 619 Ko. Mais le temps de chargement n'a pas bougé : le poids n'était plus le facteur limitant** |
| ~~5~~ | ~~**V3-R4b**~~ | **Fait le 12 septembre — mais le diagnostic de l'audit était faux : voir ADR 0021** |
| ~~7~~ | ~~**V3-R7**~~ | **Fait le 13 septembre — les deux boucles converties vers la primitive groupée qui existait déjà. Mesure en production restante, cf. le ticket** |
| ~~6~~ | ~~**V3-R5**~~ | **Fait le 12 septembre — 45 → 9 préchargements, et le chargement passe de 5 285 à 3 304 ms. Le ticket le plus rentable du lot, à l'inverse de ce qui était prévu** |

**Ce que la mesure du 12 septembre a changé dans cet ordre.** `V3-R0` a été faite, et elle a retourné les priorités : le JS ne pèse que 263 Ko quand une seule image en pèse 2 071. `V3-R4a` passe donc devant tout, et `V3-R3` (découper les éditeurs de blocs) perd beaucoup de son urgence — il reste juste, mais il se dispute des dizaines de Ko là où `R4a` en gagne deux mille.

**`V3-R6` reste à faire et monte en valeur.** Mesure complémentaire du 12 septembre : une seconde visite ne transfère que **3 Ko** et prend pourtant **4,4 s**. Le temps restant n'est pas dans les octets, il est côté serveur — les 9 vagues de rendu de l'audit. Le TTFB mesuré confirme : ~0,3 s sur `/login`, **0,6 à 2,9 s** sur les routes de monde. Une fois `R4a` fait, c'est là que sera tout le temps restant, et `P‑05` (la région) est la première chose à aller regarder.

---

## 3. Critères d'acceptation transversaux

À vérifier sur **chaque** ticket des lots B et C, pas seulement à la fin :

- [ ] Aucun nombre aléatoire ne provient du modèle. Jamais. Aucune exception.
- [ ] Aucun résultat de règle ne provient du modèle.
- [ ] Aucune écriture en base ne vient directement du modèle : `ai_proposals` sans détour.
- [ ] Tout contenu du wiki entrant dans un prompt passe par `fenceUntrustedData`.
- [ ] Le contexte est borné par l'audience de la sortie — pas de bloc `gm` dans une narration lue par le joueur.
- [ ] `ai_usage_log` est écrit à chaque appel, y compris quand l'appel échoue.
- [ ] Un tour reste jouable si le fournisseur d'IA est éteint : les dés, les PV et la scène avancent, seule la prose manque.
- [ ] Moins de 600 tokens d'entrée par tour, mesuré.
- [ ] `src/core/**` reste pur.

Le dernier point de cette liste est le plus important en pratique : **le solo doit rester jouable sans IA du tout.** C'est ce qui protège du jour où le fournisseur local est éteint, où le modèle déçoit, ou simplement où l'on veut jouer sans attendre dix secondes par tour. Si le mode solo ne fonctionne pas avec l'IA débranchée, l'architecture a glissé.

---

## 4. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Où vit `SceneState` ? | Table dédiée, pas un jsonb sur `campaigns` — voir V3-A4 |
| Le modèle peut-il proposer une esquisse de sa propre initiative ? | Non en V3. Le moteur décide quand générer ; le modèle habille. À rouvrir après une vraie partie |
| Combien de tours garder en clair avant de résumer ? | À mesurer, pas à décider maintenant — dépend du modèle réellement utilisé |
| Un modèle distant pour la narration, local pour le reste ? | `AiProvider` le permet déjà sans rien changer. À essayer quand la prose locale gêne vraiment |
| Génération procédurale de lieux (donjons, quartiers) | Idée future. Jamais un ticket tant que le reste n'est pas solide |
| L'IA peut-elle jouer un PNJ en conversation longue ? | La faiblesse constatée par S1. À ne pas tenter avant que le lot B tourne |
| Mode « aventure guidée » (scénario écrit à l'avance) | Séduisant, mais c'est un autre produit. À ne pas mélanger à celui-ci |

---

## 5. Rappel de méthode

**Un ticket, un commit, une relecture.** Inchangé depuis la V1.

**Ne pas ouvrir le lot C avant que le lot B tourne.** L'écriture du monde n'a de sens que si la boucle de tour est fiable ; ouvrir les deux ensemble donnera deux chantiers à 80 %.

**Le lot D peut avancer en parallèle, et c'est même recommandé** — voir l'écran change la conception du reste, et c'est le lot le plus gratifiant à construire. Le risque R9, la perte de motivation, reste le premier risque de ce projet.

**S2 avant tout le reste.** Une journée pour lever le seul doute que l'ADR 0009 a laissé ouvert, avant d'en bâtir six lots.
