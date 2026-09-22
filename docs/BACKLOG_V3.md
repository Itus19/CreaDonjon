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
| Aucun suivi de scène : les PNJ « présents » restaient figés toute la session | **V3-A4 — fait** (l'état existe et est persisté), puis **V3-B2** pour le faire avancer en jeu |
| Le contexte de personnage était un instantané pris une fois | **V3-B3** |
| Rien ne forçait le passage par la résolution mécanique avant de narrer un combat | **V3-B1** (la barre d'intention) — c'est le ticket le plus important du lot B |
| Pas de voie pour faire parler un PNJ incident sans lui inventer un identifiant | **V3-C2** (l'esquisse) |

Et le point resté ouvert dans l'ADR — *« le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout »* — est repris en tête de ce backlog sous **V3-S2**.

---

## 1. Ce qui existe déjà — inventaire du 6 septembre, complété le 21

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

**Construit par la V3 elle-même** (21 septembre) — à lire avec la réserve qui suit :

| Brique | Où | État |
|---|---|---|
| Déclencheurs en données : 20 événements, 11 effets, quatre bornes | `src/core/rules/triggers.ts` | complet, pur, terminaison garantie par construction |
| Ce que la résolution mécanique émet | `src/core/rules/gameEvents.ts` | attaque, sauvegarde, test, tour — le combat n'a pas d'appelant |
| Magasin de déclencheurs, **sans table dédiée** | bloc `triggers` + `src/server/services/triggerStore.ts` | complet — hérite de la chaîne de rulesets, des surcharges et du homebrew |
| Câblage jet → événement → déclencheur | `src/server/services/triggerRuntime.ts`, `checkRolls.ts` | les trois jets à verdict ; vérifié en direct |
| État de scène et zones abstraites | `src/core/rules/scene.ts`, table `scene_states` | complet et persisté ; **rien ne le fait avancer** |
| Économie d'action | `src/core/rules/actionBudget.ts` | complet ; **rien ne tient un budget de tour** |

**La réserve, et elle est importante :** le moteur *propose* des effets, il n'en applique aucun. Il n'existe pas encore de tour pour les recevoir, ni rien qui fasse avancer la scène. Une règle maison se saisit, se relit et part — sans rien changer à la partie. C'est le lot B qui referme ça.

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

> **État au 22 septembre 2026.** S2 est rendu (verdict positif : le lien tient, le lot B peut s'écrire en prose libre). **Le lot A est clos — A1 à A6.** **Le lot B est ouvert : B1 est fait, et la boucle de B2 tourne** — la barre d'intention, l'application des effets, la scène qui avance ; il reste la narration (seconde moitié de B2), puis B3, B4 et **B5** (la demande de jet, qui corrige la dernière étape de B1). **Le lot D a été réécrit le 22 septembre d'après une esquisse jouable**, reprise sept fois avec l'auteur : ses six tickets décrivent un écran qui a été ouvert et cliqué, plus une intention. Les trois cases du lot A restées décochées sont **désormais tenues par le lot B**, comme annoncé : la scène avance, le budget de tour se tient, et les événements d'attaque ont enfin un appelant. Le lot R l'est aussi, à l'exception de `P‑07`. Les lots C, D, E et F ne sont pas commencés.
>
> Ce que le lot A produit : un moteur de déclencheurs pur et borné, 20 événements et 11 effets fermés, un magasin sans table dédiée (bloc `triggers` sur une entrée de ruleset), le câblage des trois jets à verdict, une scène persistée, l'économie d'action, un bac à sable et un formulaire de saisie.
>
> **Deux limites, à lire avec.** D'abord, **rien n'applique les effets** : le moteur les *propose*, il faut un tour pour les recevoir — lot B. Rien ne fait avancer la scène non plus. Ensuite, **le vocabulaire d'effets est trop étroit** : sur les six règles SRD visées par A6, une seule est exprimable, et cinq manques distincts sont comptés (voir A6). Élargir le vocabulaire est une question **ouverte, non tranchée**.
>
> Autrement dit : une règle maison se saisit, se relit et part — mais elle ne change encore rien à la partie, et beaucoup de règles réelles ne s'écrivent pas encore.

**A avant B avant C** — ce sont de vraies dépendances, pas une préférence : la boucle a besoin de l'état de scène, et l'écriture du monde a besoin de la boucle.

**D peut commencer en parallèle de C.** L'écran se construit contre des données factices sans rien attendre ; c'est même souhaitable, parce que voir l'écran change la conception du reste.

**Le lot R est hors de cette séquence.** Il ne construit pas le solo : il reprend les constats de rapidité de l'audit restés ouverts, centrés sur le téléphone. Il n'a aucune dépendance vers les autres lots et aucun autre lot ne l'attend. Ses deux premiers tickets (`V3-R0`, `V3-R6`) tiennent en une soirée et devraient être faits tôt, parce qu'ils disent si le reste vaut la peine.

**E et F attendent une vraie partie jouée.** Concevoir la mémoire longue avant d'avoir joué trois séances, c'est deviner.

---

## S2 — Reboucler le lien fait-mécanique → narration · `S` — **fait le 19 septembre, verdict positif**

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

### V3-A2 — Brancher le vocabulaire d'événements · `M` — **fait les 19-22 septembre, combat compris**

- [x] La résolution mécanique émet les événements — `src/core/rules/gameEvents.ts`. **`resolveAction` n'existe pas** : le ticket nomme une fonction absente du code. Les vrais points de résolution sont `resolveAttackRoll`, `resolveDamageRoll`, `resolveCheckRoll` (`action.ts`) et `advanceTurn` (`combat.ts`). Trois constructeurs couvrent ceux qui ont un producteur réel aujourd'hui : `eventsForAttack`, `eventsForSave`, `eventsForTurn`. Les douze autres événements du vocabulaire n'ont encore rien qui les produise — leur écrire un constructeur maintenant serait de l'échafaudage.
- [x] Chaque événement porte son contexte, préfixé `event.` et donc lisible par un `ref` de condition (`event.damage`, `event.roll`, `event.ac`, `event.critical`, `event.dc`, `event.round`).
- [x] Un déclencheur qui échoue est journalisé, jamais silencieux, et n'interrompt pas le tour — `TriggerRunResult.failures`, plus une ligne `ECHEC` dans la trace. Une règle maison mal formée ne fige plus une partie ; les effets déjà résolus par ce déclencheur sont conservés, parce qu'ils correspondent à des dés déjà lancés.
- [x] **Le magasin de déclencheurs existe — et il n'a demandé aucune migration** (21 septembre). Un déclencheur n'est pas une entité technique : c'est une **donnée de règle**, donc un **bloc typé `triggers`** porté par une entrée de ruleset, exactement comme `modifiers` l'est pour le moteur de fiche. Il hérite ainsi de quatre mécanismes déjà écrits et testés — chaîne de rulesets, surcharges (`ruleset_overrides`, où vit tout le homebrew), traductions, éditeur de blocs. Une table `triggers` aurait exigé de refaire les quatre. `ruleset_entry_blocks.block_type` est un `text` **sans contrainte CHECK** (migration 20260729204001) : rien à migrer, vérifié avant d'écrire quoi que ce soit. Lecture par `loadTriggersForEntries` (`src/server/services/triggerStore.ts`), qui passe par `resolveEntryBlocksInRulesetBatch` — une requête groupée, le même moteur que les modificateurs génériques, et qui voit donc le homebrew.
- [x] **Câblé (21 septembre)** — `triggerRuntime.ts` : les trois jets à verdict de `checkRolls.ts` (caractéristique, compétence, sauvegarde) émettent leur événement et font partir les déclencheurs portés par les **aptitudes** du personnage. La sortie du moteur part dans le `detail` du jet enregistré : un jet et ce qu'il a réveillé se relisent ensemble, jamais dans deux lignes à recoller. `buildActorState` définit le vocabulaire de références qu'un auteur de règle écrira (`save.con`, `ability.cha`, `hp.current`, `ac`…) — verrouillé par des tests, parce que le renommer casserait silencieusement toutes les règles déjà saisies.

**Les effets ne sont PAS appliqués, et c'est délibéré.** Le moteur *propose* des `ResolvedEffect` ; les appliquer — retirer une condition, retrancher des PV — suppose l'état de scène et l'économie d'action, soit **V3-A3 et V3-A4**. Le moteur tourne, se montre et se consigne, mais rien ne mute tant que ce qui doit recevoir les effets n'existe pas.

**Un jet n'est jamais perdu pour une règle cassée.** Le dé a été lancé, son résultat est acquis : une panne du moteur de déclencheurs est consignée avec le jet plutôt que de le faire échouer.

- [x] **Le combat est câblé (22 septembre).** `moveTurn` (`combats.ts`) émet les événements de bascule et fait partir les déclencheurs du participant dont le tour commence.

  **La correction d'un constat faux écrit ici le 21 septembre.** J'avais noté qu'`advanceTurn` « n'a pas d'appelant serveur » : il en a un depuis toujours, `moveTurn`, avec round et index persistés. Le vrai obstacle était de conception — `fireTriggersForCharacter` exige une `DerivedSheet`, qu'un **monstre** n'a pas. Le moteur était taillé pour un personnage, pas pour un participant de combat.

  **La réponse, la moins chère des deux envisagées** : `buildMonsterActorState` compose l'acteur depuis le bloc `stat_block`, qui porte déjà CA, PV, caractéristiques, maîtrises de sauvegarde et bonus de maîtrise. Et il arrive dans la **même requête** que les déclencheurs (`resolveEntryBlocksInRulesetBatch`) — aucune requête de plus, aucune fiche à dériver.

  Trois arbitrages, écrits parce qu'ils ne vont pas de soi :
  - **Uniquement en avant.** Revenir au tour précédent est une correction, pas un tour joué : refaire partir un poison à chaque retour en arrière serait un défaut difficile à voir.
  - **L'état vivant prime sur la fiche.** Un monstre blessé n'a plus ses PV d'origine, et une CA corrigée à la main par le MJ écrase celle du bloc. `null` veut dire « non renseigné », jamais « zéro » — les confondre donnerait une CA 0 à tout participant dont la ligne ne la précise pas.
  - **Une panne du moteur n'emporte jamais la bascule.** Le tour a changé, c'est acquis ; le perdre pour une règle maison cassée serait le pire des échanges. L'échec part dans le journal avec le tour.

  **Vérifié en direct** (base réelle, variante de ClaudeLand) : déclencheur posé en surcharge sur `goblin-warrior`, `turn_start` → sauvegarde de Constitution DD 13 résolue **avec le bonus lu dans son `stat_block`** (total − dé = 0, correct pour un gobelin Con 10 non maîtrisé), échec → 3 dégâts de poison. Sans la condition, rien ne part. Aucun combat créé pour ce test : `session_events` est en ajout seul par conception, un faux combat aurait laissé des traces permanentes.

  **Deux limites qui restent.** Un participant-**entité** ne déclenche pas encore : ses règles viennent de ses aptitudes, donc de sa fiche dérivée, que la bascule ne connaît pas — à rejoindre quand la boucle de tour résoudra les fiches de toute la scène. Et `has_feature` est toujours faux pour un monstre : ses traits vivent dans un bloc `traits` sans clé interrogeable.

**La vérification a trouvé un défaut réel que les tests unitaires ne pouvaient pas voir.** `sheet.features[].key` mélange trois familles : des clés d'entrée telles quelles (`rogue-sneak-attack`), des clés d'**affichage préfixées** (`species:fiendish-legacy-infernal`, `background:artiste`), et des marqueurs de **choix** (`choice:rogue.skills`) qui ne correspondent à aucune entrée. Le câblage les passait toutes au magasin : **les déclencheurs d'une espèce ou d'un historique étaient donc introuvables, en silence.** Les tests unitaires utilisaient des clés nues et ne pouvaient rien en dire. Corrigé par `entryKeysForFeatures`, qui énumère les préfixes connus plutôt que de couper au premier `:` — couper aveuglément ferait disparaître les déclencheurs d'une clé légitime qui en contiendrait un.

**Défaut relevé en passant — corrigé le 21 septembre.** `resolveOneEntryBlocks` faisait confiance au `block_type` porté par une surcharge et le castait en `BlockType`. Une surcharge mal formée faisait tomber la résolution de TOUTE la fiche sur un `Cannot read properties of undefined`. La cause n'était pas la surcharge : c'était **un cast qui faisait mentir le typage**. `dataSchemaForBlockType` rend désormais `| undefined` dans les **deux** registres (blocs de wiki et blocs de règle), ce qui a fait désigner par le compilateur les **trois** sites lisant un type depuis la base — deux dans `rules.ts`, un dans `blocks.ts`. Chacun traité selon ce qu'il doit faire : les deux chemins de résolution **écartent et signalent** (`ResolvedEntryBlocks.rejectedBlocks`), l'édition d'un bloc d'entité **refuse avec un message nommant le type**, l'inconnu y étant une faute et non un cas à tolérer. La décision « valider ou écarter » est extraite en `parseBlockData`, fonction pure : elle se prenait à deux endroits, et un seul des deux aurait fini par diverger.

**Choix de conception.** Les résolveurs restent des fonctions pures sans effet de bord : `gameEvents.ts` **traduit** leur résultat en événements, il ne les modifie pas. Leur donner un effet de bord « émetteur » aurait cassé ce qui fait leur valeur — on peut les appeler sans moteur de déclencheurs du tout.

**Le vocabulaire passe de 18 à 20 événements — ADR 0028.** En instrumentant A2, deux trous sont apparus. D'abord, `checkRolls.ts` expose quatre types de jets (caractéristique, compétence, sauvegarde, initiative) et **seule la sauvegarde** avait ses événements : une Persuasion réussie, une Intuition ratée, une Investigation n'émettaient rien. 14 des 18 événements ne se produisaient qu'en combat, alors que l'auteur rappelle que l'histoire est « le 80 % du jeu ». Ensuite, `FiredEvent` ne portait que des nombres : aucune condition ne pouvait demander **quel** sort, **quelle** condition, **quelle** compétence — un trou qui touchait déjà `spell_cast` et `condition_applied`. D'où `check_passed`/`check_failed`, des étiquettes sur l'événement, et l'opérateur `event_has`, miroir exact de `has_condition` mais sur l'événement. Les événements narratifs sans producteur (`attitude_changed`, `discovery_made`, `time_advanced`) sont volontairement écartés : ils reviendront avec le lot qui les émettra.

**Un coup émet les deux faces de l'échange** (`damage_dealt` sur l'attaquant, `damage_taken` sur la cible) : c'est ce qui permet au vol de vie et à la concentration de s'accrocher au même coup, et c'est la raison d'être du champ `subject`.

### V3-A3 — Économie d'action · `M` — **fait le 21 septembre**

- [x] `ActionBudget` — action, bonus, réaction, déplacement (en mètres, dérivé de la vitesse), gratuit. `src/core/rules/actionBudget.ts`, pur.
- [x] **Signaler, ne pas interdire.** `spendFromBudget` ne refuse jamais rien et ne lève jamais : le budget descend **en négatif**, et c'est ça le signal. Un plancher à zéro aurait effacé l'information même qu'on voulait porter. `overBudget` porte sur la catégorie touchée, pas sur le tour, pour que l'interface marque la bonne ligne.
- [x] Un déclencheur peut accorder ou retirer du budget — nouvel effet `grant_budget`, **ADR 0029**. Un montant négatif retire : un seul effet pour les deux sens. « Fougue du guerrier » s'écrit désormais en données.
- [ ] **Remis à zéro sur `turn_start` — non câblé.** `budgetForTurn` existe, mais rien ne tient le budget d'un tour : il n'y a pas encore de tour. C'est la boucle de tour (lot B) qui l'appellera et appliquera `grant_budget`.

**La spec se contredisait, et l'implémentation l'a révélé.** Son §5 exige qu'un déclencheur puisse accorder du budget ; son §4 ferme le vocabulaire d'effets à dix entrées dont aucune n'y touche. Sans l'ADR 0029, le quatrième critère de ce ticket était inatteignable. Détourner `spend_resource` a été écarté : le budget n'est pas un tracker de ressource (il se réinitialise chaque tour, n'a pas d'identifiant de bloc, accepte des négatifs).

**Le vocabulaire d'effets compte onze entrées**, verrouillé par test comme les vingt événements.

### V3-A4 — État de scène et zones abstraites · `M` — **fait le 21 septembre**

**Le ticket qui débloque tout le solo.** C'est le trou n° 1 d'ADR 0009.

- [x] `SceneState` : lieu, entités présentes, heure en jeu, éclairage, combat en cours, cinq derniers événements — `src/core/rules/scene.ts`, module pur. Toutes les fonctions rendent une **nouvelle** scène, jamais de mutation sur place : c'est ce qui rendra possible d'annuler un tour (V3-F2).
- [x] **Tenu par le moteur.** `advanceTime` fait franchir minuit par arithmétique, sur n'importe quel délai (repos long, voyage de plusieurs jours). Il **refuse un delta négatif** : le temps de jeu ne remonte pas, et laisser passer un recul transformerait un bug d'appelant en incohérence difficile à retrouver.
- [x] Trois zones abstraites, pas de grille. **Et elles servent enfin** : `buildActorState` posait `engaged` en dur, donc `in_range` était toujours vrai — une aura de paladin s'appliquait à l'autre bout de la taverne. La zone vient désormais de la scène.
- [x] Persisté : table `scene_states` (migration `20260921210000`, appliquée), une ligne par campagne, `zSceneState` validant **à la lecture comme à l'écriture** — une colonne `jsonb` ne garantit rien par elle-même.
- [x] Aucun champ n'est écrit depuis une sortie de modèle : aucun chemin ne relie un modèle à cette table, et `updated_by` trace qui l'a fait avancer.
- [ ] **Reste** : faire avancer la scène depuis le jeu (qui entre, qui sort, quand le temps passe). C'est la boucle de tour — lot B — qui l'appellera ; A4 fournit l'état et ses opérations, pas ses déclencheurs.

**Limite assumée du contexte de déclencheur.** Les autres présents entrent dans le contexte avec leur **zone** mais sans fiche dérivée : on connaît leur distance, pas leurs conditions. Assez pour une aura, pas pour un `has_condition` sur eux. Cette borne tombera quand la boucle de tour résoudra les fiches de toute la scène.

**`SCHEMA.md` ne prévoyait aucune scène** — A4 était donc un changement de schéma non planifié, ce qui est normalement un point d'arrêt. Le ticket le planifiait avec sa recommandation, suivie telle quelle ; `SCHEMA.md` gagne sa section 26 pour que la règle ne devienne pas une formalité.

**Précision de conception, à décider ici** — où vit `SceneState` ? Recommandation : une table `scene_states` avec une ligne par campagne (la scène courante) plus un historique dans `session_events`, plutôt qu'un champ jsonb sur `campaigns`. Raison : la scène change à chaque tour, `campaigns` ne doit pas devenir une table chaude, et l'historique est déjà le rôle du journal.

### V3-A5 — Éditeur de déclencheurs au formulaire · `L` — **fait et vérifié en direct le 21 septembre**

- [x] Un bac à sable : « si tel événement survient avec telles données, voici ce qui se passerait » — sans toucher à une vraie partie. Outil de règles `bac-a-sable-declencheurs`, même famille que le bac à sable de formule : fenêtre flottante, entrée de barre latérale, page dédiée.
  - **Même moteur que le jeu, jamais un chemin parallèle** : `/api/triggers/simulate` appelle `runTriggers`, exactement la fonction qu'un vrai jet invoque. Un bac à sable qui simulerait à sa façon mentirait le jour où l'on en aurait besoin — la raison même du critère, déjà posée par V1-D4.
  - **Aucune lecture ni écriture en base** : déclencheurs, événement et acteurs viennent tous de la requête. C'est ce qui rend l'outil utile — on y essaie « et si le personnage était concentré, à 3 PV, et que le coup faisait 22 dégâts ? » sans mettre un personnage réel dans cet état.
  - Les **échecs** s'affichent au même rang que les succès : dans un bac à sable, une règle qui échoue est l'information la plus utile.
  - **Vérifié en direct** : la concentration part sur 22 dégâts (`DD 11`, soit `max(10, floor(22/2))` — le vrai calcul), la trace montre `damage_taken -> concentration (profondeur 1)` ; sans la condition `concentrating`, « rien ne se déclenche » ; un JSON cassé est annoncé comme une saisie, sans appel au serveur.
- [x] **Le formulaire guidé** — section « Déclencheurs » de `CreateHomebrewFeatureForm`, exact analogue de sa section « Effets chiffrés » qui produit déjà un bloc `modifiers` : c'est là qu'on **écrit** une règle, quand le bac à sable est là où on l'**essaie**. Il n'existe **aucun générateur de formulaire depuis Zod** dans ce dépôt ; « même méthode que les blocs existants » veut donc dire un formulaire **dédié, à vocabulaires fermés en listes déroulantes**, et c'est ce qui est fait — les 20 événements, trois formes de condition, six effets, tous en listes.
  - `quand` / `si` / `alors`, en français, sans jamais montrer de JSON à l'auteur. Le préfixe `event.` est posé tout seul : il n'a pas à connaître cet encodage.
  - La conversion brouillon → déclencheur est **hors du composant** (`lib/triggers/draft.ts`, 11 tests) : c'est la seule logique du formulaire qui puisse se tromper en silence — une condition mal composée produit un déclencheur que Zod accepte mais qui ne part jamais, et aucun typage ne le verrait.
  - Une ligne incomplète est **signalée sous elle et écartée** à l'enregistrement, plutôt que de faire échouer tout l'import de la fiche.
  - **Plafond assumé** : trois formes de condition et six effets, pas l'AST complet. Une règle comme la concentration (jet de sauvegarde avec branche d'échec) se compose dans le bac à sable, en JSON. Construire un éditeur d'AST générique pour des cas qui n'existent pas encore serait l'abstraction que ce projet refuse.
- [x] **« Sans redémarrage » — constaté le 21 septembre**, sur la session de l'auteur (la variante d'un monde n'est proposée qu'à son propriétaire : `listSelectableRulesetsForCurrentUser`, ce qui avait d'abord bloqué la vérification avec un compte invité). Aptitude « Lecteur de mensonges » créée au formulaire dans ClaudeLand → surcharge `add_block` écrite avec l'identifiant stable `lecteur-de-mensonges-1` → **la fiche et son bloc s'affichent sur le serveur qui tournait déjà**, sans redémarrage ni vidage de cache.

**Un défaut trouvé par cette vérification, et invisible autrement.** La section « Déclencheurs » s'affichait avec son titre et **rien dedans** : le catalogue rend chaque type de bloc par un composant dédié (`blockContentRenderer.tsx`), et `triggers` n'avait pas le sien — le bloc était bien stocké et bien lu, mais muet à l'écran. Corrigé par l'exact analogue de `Modifiers`, sans nouvelle mise en page.

**Ce qui n'est pas prouvé par ce test précis** : que *cette* aptitude-là parte sur un vrai jet — elle n'est portée par aucun personnage. Que le moteur fasse partir un déclencheur stocké sur une aptitude réellement possédée a été prouvé séparément lors de la vérification de V3-A2.

### V3-A6 — Convertir les règles SRD qui ont des déclencheurs · `L` — **fait le 22 septembre, et il rend un verdict inattendu**

- [x] **Le compte est tenu** — `src/core/rules/srdTriggers.test.ts`, sous forme **exécutable** plutôt que sous forme d'affirmation. Chaque règle du ticket y est *écrite*, pas jugée à vue ; ce qui ne passe pas est verrouillé par un test qui **tombera le jour où la capacité manquante sera ajoutée**, pour rappeler de revenir réécrire la règle.
- [x] Une règle SRD réellement convertie : **Fumées d'othur brûlées** (`burnt-othur-fumes`), sauvegarde CON DD 13 au début de chaque tour, 1d6 de poison à chaque échec. Écrite en **donnée** (`data/srd/triggers-2024.json`), jamais en code — on ajoute une règle en éditant un JSON. Lue par `ingest-srd.ts` plutôt que par un script à part, parce que l'import **recrée les blocs à chaque passage** : un bloc posé hors import serait effacé au prochain `npm run ingest:srd`, le piège qui vaut déjà à `encounter-budget` d'être rejoué à la main.

**Sur les six règles nommées par le ticket, UNE SEULE est exprimable — et même elle, seulement en partie.**

| Règle | Verdict | Ce qui manque |
|---|---|---|
| Poison qui ronge (*Fumées d'othur*) | **convertie**, partiellement | « s'arrête après trois réussites » : le moteur ne compte pas d'un tour à l'autre |
| Aura de paladin | inexprimable | un modificateur **calculé** : `Modifier.value` est un nombre, pas une formule — « + ton modificateur de Charisme » n'a aucune écriture |
| Rage | inexprimable | un effet **qui dure** : un effet est une proposition ponctuelle, il n'existe aucun « tant que » |
| Résistances et immunités | inexprimable | **modifier les dégâts subis** : `damage_taken` arrive déjà calculé, et `deal_damage` ne sait qu'ajouter |
| Attaque d'opportunité | à moitié | **agir** : `movement` + `in_range` détecte l'occasion, `grant_budget` consomme la réaction, mais aucun effet ne déclenche une attaque |
| Second souffle | hors catégorie | ce n'est pas un déclencheur mais un **choix** du joueur — relève de la barre d'intention (V3-B1) |

**Cinq manques distincts, la règle des trois est donc largement franchie.** Le ticket dit : « à la troisième, rouvrir la question d'une échappatoire ». Elle est rouverte, et c'est une décision de l'auteur, pas une à prendre seul :

1. **Un modificateur dont la valeur est une formule** — `Modifier.value` en `FormulaNode`. Le plus petit des cinq, et il débloque toutes les auras.
2. **Un effet qui dure** — le plus structurant : il suppose de savoir défaire un effet, donc de le suivre. Touche aussi `entity_active_effects`, table créée en Phase 0 et jamais écrite.
3. **Modifier un jet en cours** (dégâts subis, et par extension avantage conditionnel) — demande que la résolution mécanique *consulte* les déclencheurs au lieu de seulement les notifier. C'est un changement de sens du moteur.
4. **Agir depuis un déclencheur** (attaque d'opportunité) — suppose l'économie d'action *appliquée*, donc le lot B.
5. **Compter d'un tour à l'autre** — un état par déclencheur ; le plus petit besoin, mais il ouvre la porte à un état arbitraire.

**Ce que ce constat ne remet PAS en cause.** Le mécanisme lui-même tient : le cas doré de V3-A1 (la concentration) s'écrit entièrement en données, et le poison converti fonctionne. Ce qui manque n'est pas la forme déclarative, c'est l'**étendue du vocabulaire d'effets** — précisément ce que la spec §3 prévoyait d'élargir au vu de cas concrets, plutôt que de deviner à l'avance. Les cinq ci-dessus sont ces cas concrets.

---

# Lot B — La boucle de tour

*Ce lot n'existe dans aucune spec. C'est le chaînon manquant entre le moteur (lot A) et l'écran (lot D).*

### V3-B1 — La barre d'intention · `L` — **fait le 22 septembre**

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

- [x] Interprétation de l'intention : correspondance déterministe — `src/core/rules/intent.ts`, module pur, 17 tests écrits avant le code. Il réutilise `detectEntityReferences` (V0-05) plutôt qu'un second moteur de correspondance : mêmes frontières de mots, même priorité à la correspondance la plus longue (« épée longue » l'emporte sur « épée »), accents et casse ignorés. Le lexique de verbes est en français, donc dans `src/i18n/fr.ts` — fermé, sans conjugaison devinée.
- [x] La proposition mécanique est **toujours affichée avant d'être exécutée**, et modifiable en un clic — « ce n'est pas ça » ouvre le choix de l'action, de la cible, de l'avantage et du DD. La correction est consignée (`intent.corrected`), pour savoir plus tard ce que le lexique rate vraiment.
- [x] Une intention non reconnue tombe dans « action libre » — et elle dit **laquelle des deux raisons** : rien de reconnu, ou verbe compris mais cette fiche n'a rien pour le faire (aucune arme équipée). Journalisée en `player_action` avec `resolution: "aucune"`, jamais en silence.
- [x] **Aucun appel au modèle**, point — `turnIntent.noAi.test.ts` verrouille les quatre fichiers du chemin (noyau, service, route, écran) contre tout import de `src/server/ai/` ou `src/core/ai/`. Le test tombera le jour où V3-B2 branchera la narration : il faudra alors venir y écrire l'ordre à la main, en connaissance de cause.
- [x] Le résultat mécanique complet est journalisé en `session_events` (`kind: 'roll'`) avant de rendre la main, avec les `facts` en phrases — c'est exactement ce que V3-B2 donnera au modèle.

**Pourquoi ce dessin plutôt qu'un simple champ de texte :** l'ADR a montré qu'une case à cocher facultative ne suffit pas. Ici, la mécanique n'est pas une option qu'on peut oublier — c'est le chemin. Et le joueur y gagne : il voit ce que le moteur a compris avant que ça parte, ce qui supprime la frustration du « ce n'est pas ce que je voulais faire ».

> **Sa dernière étape est dépassée depuis le 22 septembre.** En dessinant le lot D, l'auteur a décrit le vrai déroulé d'une table : le moteur **demande** un jet, et c'est le joueur qui lance — bouton de la fiche, outil de dés, ou dé physique annoncé. Ici « Lancer » résout dans la foulée. Tout le reste de ce ticket tient (l'interprétation, le catalogue, la correction, le journal) ; c'est la résolution qui se scinde, et c'est **V3-B5**.

**Trois décisions prises en écrivant, à lire avant B2.**

**Le repli par le modèle n'est pas écrit, et c'est délibéré.** Le ticket le prévoyait « uniquement pour classer » ; il attend d'être nourri par des cas réels. Le lexique compte une quinzaine d'entrées, chacune justifiée dans `INTENT_VERBS_FR`, et trois familles en sont volontairement absentes (« lancer », ambigu entre le javelot et le sort ; « regarder »/« chercher », trop courants pour ne pas déclencher un jet à contretemps ; les compétences de savoir, qu'aucun verbe ne désigne seul). Ce qu'elles ratent se mesurera en jouant — `intent.corrected` est là pour ça.

**Les cibles viennent du combat en cours, pas seulement de la scène.** La scène (V3-A4) est la source de vérité de « qui est là », mais **rien ne la fait encore avancer** — c'est précisément le reste du lot B. Les participants d'un combat `running`, eux, existent aujourd'hui et portent une CA : sans eux, la barre n'aurait eu personne à viser. Les deux sources sont lues, le combat d'abord parce qu'il est le seul à donner une CA. Sans CA, l'attaque est lancée mais **sans verdict** — on ne l'invente pas.

**Rien n'est appliqué à la cible.** Les PV du gobelin ne bougent pas : appliquer un effet est V3-B2. Le fait est établi et journalisé, ce qui suffit à la narration et permettra de l'appliquer plus tard sans relancer le dé. Dans la même logique, `eventsForAttack` (V3-A2) reste sans appelant — B1 lui fournit enfin ce qui lui manquait, la CA de la cible, mais c'est la boucle de tour qui fera partir ces déclencheurs, comme pour tous les autres.

**Vérifié en direct, le 22 septembre, sur la base réelle.** Fiche de contrôle créée dans `ClaudeLand` (le monde jetable), puis supprimée avec ses traces — session, jets, combat, revendication, blocs, entité ; la campagne est revenue à son état d'avant, vérifié ligne par ligne.

| Ce qui a été exercé | Résultat |
|---|---|
| « je fouille la piece » | `Test · Investigation` proposé **en frappant**, sans aller-retour |
| « j'escalade le mur » | `Test · Athlétisme` — le verbe désigne sa compétence |
| « ce n'est pas ça » → cible `Gobelin 2 — CA 15`, DD 12 | *« Perrin — Athlétisme — test de Force sur Gobelin 2 : 14 (dé : 12, Force +2) contre DD 12 — réussite »*, journalisé en `roll` avec `corrected: true` |
| « je regarde autour de moi en silence » | Action libre, journalisée en `player_action`, aucun dé |
| 375 px, panneau de correction ouvert | Aucun débordement horizontal |

Le jet est parti par le vrai chemin partagé : le volet de dés (V2-M11) s'est ouvert tout seul en temps réel avec le d20 et le détail du modificateur — preuve qu'aucune voie parallèle n'a été créée.

**Un défaut trouvé par cette vérification, et corrigé :** le fait affiché contenait `1d20 + {mod}`. `expression` est un gabarit à trou composé pour la persistance — correct dans `dice_rolls`, illisible pour un joueur, et franchement dangereux dans un `fact` : c'est ce texte que le modèle recevra en B2, et un modèle à qui l'on tend `{mod}` finira par l'écrire, ou par en deviner la valeur. Les faits nomment désormais le dé et chaque modificateur (« dé : 12, Force +2 »), depuis la trace et les `chips` — jamais recomposés.

**Une limite connue, qui appartient à B2 :** le fil des tours est un état de composant. Un rechargement le vide, alors que les événements, eux, sont bien en base. Le relire est le travail de la boucle de tour.

**L'écran :** `/m/[worldSlug]/joueur/solo`, septième destination de la coquille joueur. C'est un toit minimal, **pas** le lot D : ni colonne du monde connu, ni fiche à droite. `IntentBar.tsx` est autonome et se déplacera tel quel dans la colonne centrale de V3-D4. La lecture de la phrase tourne dans le navigateur — `interpretIntent` est pur, donc la proposition s'affiche en frappant, sans aller-retour ; le serveur ne reçoit jamais une phrase à interpréter, seulement le **choix** retenu.

### V3-B2 — Le tour, de bout en bout · `L` — **la boucle est faite le 22 septembre ; la narration reste**

- [x] `playTurn(intention)` : interprète → résout → **applique les déclencheurs** → met à jour la scène → journalise. La narration (« construit le contexte → appelle le modèle ») est le reste du ticket, volontairement écrite après — c'est ce qui rend le critère transverse « jouable sans IA du tout » vérifiable **seul**, plutôt que sur parole.
- [x] **Chaque étape journalise indépendamment.** Le jet part en `roll` avant tout le reste ; l'application des effets est son propre `rule_application` ; la scène est écrite en dernier. Une étape qui tombe laisse les précédentes acquises.
- [x] Les PNJ présents sont **recalculés depuis la scène à chaque tour** — le catalogue de cibles est reconstruit côté serveur à chaque rendu, et l'écran demande un `router.refresh()` dès que la scène change. Vérifié : le combat clos, le gobelin disparaît des cibles au tour suivant.
- [ ] Budget d'entrée : moins de 600 tokens par tour, mesuré et journalisé dans `ai_usage_log` — avec la narration.

**Où la narration se branche, pour qui reprend.** Tout l'attend, à un seul endroit : `playTurn` (`src/server/services/turnLoop.ts`) construit déjà ce que le modèle doit recevoir et n'en fait rien — `record.facts` (les faits établis, en phrases, sans un seul `{mod}` technique), `changes` (ce que le tour a modifié), `hints` (les `narrate_hint` des règles déclenchées), et la scène à jour juste avant le `return`. Il ne manque qu'un appel derrière `AiProvider`, un événement `narration` de plus dans `session_events`, et le bouton « raconter ce tour » qui rejoue la prose du **même** événement — possible parce que les faits sont déjà journalisés, et sûr pour la même raison : aucun dé n'est relancé.

**À écrire sur la machine où le modèle tourne.** `AI_LOCAL_BASE_URL` et `AI_LOCAL_MODEL` sont vides sur le portable (22 septembre) : la prose ne peut pas y être observée, et S1 comme S2 ont montré que c'est justement la prose qu'il faut voir pour la juger. Le reste de la boucle, lui, a été vérifié fournisseur éteint — ce qui est la meilleure démonstration possible du critère transverse « le solo doit rester jouable sans IA du tout ».

**Ce que la boucle applique, et ce qu'elle refuse d'appliquer.** `src/core/rules/turn.ts` (pur, 13 tests) prend les `ResolvedEffect` que le moteur propose depuis A1 et rend un nouvel état plus la liste des changements. Dégâts (les PV temporaires d'abord), soins (plafonnés), conditions, zones, budget, ressources. **Un effet impossible est consigné, jamais tu, jamais levé** : un acteur absent, ou un `apply_modifier` — que A6 a compté parmi ses cinq manques, faute d'effet qui dure — ressortent avec leur raison, affichée à l'écran sous le tour. Une règle qui ne s'applique pas en silence est pire qu'une règle absente.

**Les dégâts d'un coup porté sont le premier effet du tour.** Ils ne viennent d'aucun déclencheur : ils viennent du coup. C'est ce que B1 avait laissé de côté, et l'exemple que son ticket dessinait — « Gobelin 2 : 7 → 2 PV ». Un participant de combat passe par `patchCombatParticipant`, qui écrit **aussi** l'état de jeu quand la ligne porte une entité et journalise le tout en un événement annulable ; une entité hors combat passe par `applyRuntimeStateChange`. Deux chemins parce qu'il y a deux vérités en base, jamais un troisième inventé ici.

**Trois décisions prises en écrivant.**

**Le budget de tour vit dans la scène**, indexé par acteur (`SceneState.budgets`, `__v` passé à 2). Sur l'entité, il aurait survécu à une annulation de tour qui restaure une scène entière (V3-F2) — or un budget est un fait de *cette* scène, au même titre que les zones et l'heure. Aucune migration : SCHEMA §26 a voulu ce `jsonb` validé par Zod précisément pour qu'un champ ajouté au moteur n'en demande pas, et la table était vide.

**L'horloge n'avance pas en combat.** Un round dure six secondes et `GameTime` compte en minutes : une minute par attaque ferait vieillir la partie de vingt minutes pendant un échange de coups. Hors combat, une action vaut une minute. Grossier et assumé — ce qui compte est que ce soit le code qui le décide.

**La scène se pose à la main, pour l'instant.** Rien ne la créait : le moteur la tenait depuis A4, mais aucun écran ne disait où l'on est ni qui est là. Un panneau minimal (lieu, présents) la pose ; le lot C fera entrer et sortir les PNJ tout seul, depuis les générateurs et le wiki. Sans scène, le tour se joue quand même sur une scène éphémère — une règle qui déplace quelqu'un n'aura alors personne à déplacer, et le dira.

**Un défaut trouvé en jouant, et corrigé :** le moteur ne reconnaissait pas « le gobelin » pour une ligne de combat nommée « Gobelin 2 ». Le nom sans son numéro de rang est désormais un terme de plus — la correspondance reste **exacte**, on ajoute un mot, on n'assouplit pas la règle.

**Vérifié en direct le 22 septembre**, fiche de contrôle créée dans `ClaudeLand` puis supprimée avec toutes ses traces :

| Ce qui a été exercé | Résultat |
|---|---|
| Scène posée sur un lieu | `jour 1, 08h00 · plein jour · combat en cours` — le combat qui tourne est détecté, jamais saisi |
| « je frappe le gobelin » | `Attaque · cible : Gobelin 2 (CA 12)` — la cible reconnue sans son numéro |
| Le tour lancé | `23 (dé : 19) contre CA 12 — touché`, `Dégâts : 5`, puis **`Gobelin 2 : 7 → 2 PV`** |
| En base | `combat_participants.hp_current` 7 → 2 ; `session_events` : `roll` puis `rule_application` ; `budgets.action` 1 → 0 |
| L'horloge | inchangée en combat ; `08h00 → 08h01` au tour suivant, combat clos |
| Le modèle | jamais appelé — `turnIntent.noAi.test.ts` couvre désormais aussi `turnLoop.ts` |

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

### V3-B5 — Le moteur demande un jet, il ne le lance pas · `L`

*Ouvert le 22 septembre, en dessinant le lot D. **Ce ticket corrige la dernière étape de V3-B1** : il ne la jette pas.*

**Ce que B1 fait aujourd'hui, et pourquoi ça ne tient pas.** La barre d'intention résout le jet dès qu'on appuie sur « Lancer » : le serveur lit l'intention, lance le dé et journalise, en un seul appel. C'est cohérent, c'est testé — et ce n'est pas ainsi qu'on joue. À une table, on annonce ce qu'on fait, **le MJ demande un jet**, et c'est le joueur qui lance, avec ses propres outils ou ses propres dés.

**Le déroulé visé**, tel que l'auteur l'a décrit :

```
Le joueur écrit :  « j'attaque le gobelin »
       ↓
Le moteur DEMANDE :  Attaque · épée longue · Gobelin 2 · CA 12
       ↓
Le joueur répond, de trois façons au choix :
   · un bouton de sa fiche        → le modificateur est connu, il s'ajoute au clic
   · l'outil de lancer de dés     → le dé arrive NU, le modificateur s'applique après coup
   · « j'ai fait 12 » dans le champ → même chemin que l'outil, avec un dé physique
       ↓
Le moteur encaisse le résultat, applique, journalise, avance l'horloge.
```

**La garantie du projet tient.** Un dé physique annoncé par le joueur est un nombre **humain**, pas un nombre de modèle : la règle absolue 8 interdit à un modèle de produire un aléa, elle n'a jamais interdit à la table de lancer ses dés. Le journal doit en revanche savoir que ce dé n'est pas venu du serveur — c'est ce que V3-D6 affiche.

- [ ] `executeIntent` se scinde : **proposer une demande** d'un côté, **encaisser un résultat** de l'autre. L'interprétation, le catalogue, la correction et le journal de B1 ne changent pas.
- [ ] La demande est **persistée** : elle survit à un rechargement, comme la scène. Une partie reprise trois semaines plus tard sait encore ce qu'elle attendait.
- [ ] Au plus une demande en cours par personnage. Une nouvelle intention **remplace** la précédente plutôt que d'empiler — et l'abandon est journalisé, jamais silencieux.
- [ ] Les boutons de la fiche et le volet de dés **savent qu'une demande attend** et s'y rattachent. C'est le critère de D5 (« un seul chemin vers la résolution, jamais deux ») porté côté serveur.
- [ ] Un dé venu de l'outil ou annoncé à la main arrive **nu** : le moteur applique le modificateur, jamais le client. Le `session_event` distingue les trois origines.
- [ ] Un résultat annoncé est **borné** (1 à 20 pour un d20) et refusé au-delà, avec un message — pas une valeur silencieusement écrêtée.
- [ ] Un tour peut porter **plusieurs jets** (l'attaque puis les dégâts) : ils partent ensemble.
- [ ] Les tests de V3-B1 restent verts, ou sont réécrits **en disant pourquoi**. `turnIntent.noAi.test.ts` continue d'interdire tout appel de modèle sur ce chemin.

**Pourquoi `L` et pas `M`** : la demande introduit un état de jeu de plus, donc une forme à décider, un endroit où l'écrire et un cycle de vie (posée, honorée, abandonnée). C'est moins du code que des décisions.

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

*Réécrit le 22 septembre, d'après l'esquisse jouable. Les six tickets qui suivent ne décrivent plus une intention : ils décrivent un écran qui a été dessiné, ouvert, cliqué et corrigé sept fois avec l'auteur.*

## Le dessin

**L'esquisse fait foi**, pas cet art ASCII : `components/solo/esquisse/` et la route `/m/[worldSlug]/joueur/solo/esquisse`, à jeter quand D1 arrive. Ce schéma n'en est qu'un rappel.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Monde │ Port-Valdor · L'Ancre Rouillée · salle commune                 │
│         │        Mercredi 12 juillet  22:15  Pluie · 14 °C  ♪   Fiche ›  │
├────────────────┬───────────────────────────────┬────────────────────────┤
│ Wiki Quêtes    │  Tu pousses la porte. La      │ Naivara Amakiir [à terre]│
│ Présents Règles│  salle sent la bière…       ▪ │ Elfe · Roublarde 4 ·    │
│                │                               │ Criminelle · 127 ans    │
│ LIEUX          │        je cherche le comptoir │ ███████░░░ 11/17 PV     │
│ Port-Valdor ◆  │                               │ CA 14 · 9 m · Épuis. 0  │
│ L'Ancre R.  ◆  │  JET DEMANDÉ Perception · DD 12│ Inspiration ✦          │
│ L'entrepôt  ◇  │  ┌───────────────────────────┐│ ████░░░░ 2 900 XP       │
│                │  │PERCEPTION 16 ✓ · fiche    ││ ┌FOR┐┌DEX┐┌CON┐        │
│ PERSONNES      │  └───────────────────────────┘│ └+0─┘└+3─┘└+1─┘        │
│ Bram        ◆  │  Derrière le comptoir…      ~ │ ▸ COMPÉTENCES           │
│ L'elfe      ○  │                               │ Actions Sac Magie       │
│                │  ┌───────────────────────────┐│ Traits Maîtrises        │
│ ◆ connu        │  │ Sauvegarde de Dex DD 13 — ││ ┌────────────────────┐  │
│ ○ esquisse     │  │ lance depuis ta fiche…    ││ │ Épée longue        │  │
│ ◇ mentionné    │  └───────────────────────────┘│ │ +5 · 1d8+3         │  │
│                │  [ Jouer ] [ MJ ]             │ │ [attaquer][dégâts] │  │
└────────────────┴───────────────────────────────┴────────────────────────┘
```

**Sept passes avec l'auteur**, et ce que chacune a tranché :

| Ce qui a changé | Pourquoi |
|---|---|
| Fil **compact**, trace du jet dépliable | Ce qui encombre n'est pas l'interligne, c'est la trace |
| Onglets **en classeur** (`BinderTabs`) | Ceux de la fiche jouable — jamais une troisième présentation |
| **Le moteur demande, il ne lance pas** | C'est le déroulé d'une vraie table (voir V3-B5) |
| **Un seul champ** pour écrire et pour les jets | Un résultat se voit là où part tout le reste |
| **Deux boutons**, `Jouer` et `MJ` | Seul `Jouer` fait avancer l'horloge |
| Repli **depuis le bandeau**, boutons toujours visibles | La commande ne se déplace jamais |
| Colonnes **sans fond**, encadrés fins | Le haut de la fiche, qui ne pèse rien |

**Deux corrections à des tickets déjà écrits**, nées de l'esquisse :

- **L'adresse de D1 change.** Le ticket d'origine plaçait l'écran hors de la coquille joueur ; l'auteur veut la barre latérale et ses outils. L'écran solo est **une destination de `PlayerShell`**, sous `joueur/`, comme l'écran minimal de V3-B1.
- **La résolution de V3-B1 est dépassée.** « Lancer » résolvait le jet dans la foulée. Le vrai déroulé passe par une demande, puis une réponse — c'est **V3-B5**, ci-dessus dans le lot B. D1 à D6 le supposent fait.

---

### V3-D1 — La coquille à trois colonnes · `M`

- [ ] Route `/m/[worldSlug]/joueur/solo`, **dans `PlayerShell`** : la barre latérale joueur et ses outils restent atteignables en jouant. L'écran minimal de V3-B1 est à cette adresse — ce ticket le remplace, il n'en ouvre pas une seconde.
- [ ] Trois colonnes en `grid`, la centrale prioritaire (`minmax(0,2fr)`), les latérales bornées (200 px et 280 px au minimum).
- [ ] **Repli depuis le bandeau**, un bouton à chaque extrémité, **toujours visibles** — qu'on replie ou qu'on déplie, la commande ne bouge pas de place. Le chevron pointe vers ce qui va se passer.
- [ ] L'animation est celle du volet de dés : 200 ms, échelle et opacité, origine du côté de la colonne. **Piège vérifié le 22 septembre :** `grid-template-columns` n'interpole pas entre `minmax(200px,1fr)` et un `0px` nu — le navigateur reste bloqué sur l'ancienne valeur et la colonne ne se replie jamais. Les deux bornes doivent être des `minmax()` de même forme (`minmax(0px,0fr)` une fois repliée).
- [ ] Les largeurs et l'état de repli sont **mémorisés par personne**.
- [ ] **Sous 1024 px, les colonnes deviennent trois onglets** (Monde · Jeu · Fiche), et « Jeu » s'ouvre par défaut. Les classes d'animation du repli sont préfixées `lg:` : une colonne repliée sur grand écran ne doit pas revenir invisible dans son onglet de téléphone.
- [ ] Sous 768 px, la saisie reste ancrée en bas, au-dessus du clavier virtuel.
- [ ] Les deux colonnes repliées, **le fil ne s'étale pas** : il se recentre à 80 caractères. Replier sert à enlever le bruit autour, pas à élargir le texte.

### V3-D2 — L'en-tête d'état · `S`

- [ ] À gauche, **trois niveaux de lieu** : la ville la plus proche, le lieu à l'intérieur, puis la pièce. Les deux premiers sont des liens vers leur fiche ; **la pièce n'en est pas un** — anecdotique le plus souvent, et quand elle ne l'est pas (une salle secrète), elle vit dans un bloc de la fiche du lieu.
- [ ] À droite, la date en jeu, l'heure, la météo et la température : `Mercredi 12 juillet · 22:15 · Pluie · 14 °C`. La date vient du calendrier du monde (`formatGameDate`), l'heure de `SceneState.time`.
- [ ] **La météo et la température n'existent pas encore** — c'est V3-C6. Tant qu'il n'est pas fait, l'en-tête les omet plutôt que d'afficher une valeur inventée.
- [ ] Tout à droite, la radio d'ambiance : `RadioWidget`, le composant existe.
- [ ] **Tout y est tenu par le moteur** (critère `module-joueur-et-solo.md` §C). Un modèle ne décide ni du lieu ni de l'heure.

### V3-D3 — La colonne gauche : le monde connu · `M`

- [ ] **Quatre onglets de classeur** : Wiki, Quêtes, Présents, Règles.
- [ ] **Le wiki se navigue DANS la colonne.** Une fiche connue s'ouvre sur place, avec le chemin pour revenir (`← Lieux`) et un lien vers la fiche entière. Une fiche seulement *mentionnée* n'est pas cliquable : il n'y a rien à ouvrir.
- [ ] **Un marqueur de découverte sur chaque entrée** : connu `◆`, esquisse `○`, mentionné `◇`, avec leur légende en pied de liste.
- [ ] **Quêtes** : les blocs `quest` en cours, avec leurs objectifs cochés ou non, le compte (`1/3`), le donneur et la récompense. `listActiveQuestsForWorld` existe depuis la V2 et n'a jamais eu d'appelant — il en a un.
- [ ] **Présents** : qui est dans la scène, sa bande d'attitude en un mot et sa zone. Un PNJ qui n'est qu'une esquisse s'affiche comme tel, avec « garder cette fiche » qui l'ancre (V3-C2).
- [ ] **Règles** : l'écran de règles existant, en version étroite. Aucun composant nouveau.

### V3-D4 — La colonne centrale : le fil et la saisie · `L`

- [ ] Le fil **est** `session_events` rendu. Recharger la page le reconstruit à l'identique — c'est ce qui referme la limite connue de V3-B1, où le fil était un état de composant.
- [ ] **Un rendu par type** : narration en prose ; action du joueur alignée à droite, discrète ; jet en encart compact **dont la trace se déplie au clic** ; application de règle repliable ; changement du monde en mention discrète ; **réponse du MJ** sur un liseré d'accent, qui dit en toutes lettres qu'elle est hors du temps de jeu.
- [ ] **Un seul champ de saisie pour tout ce que le joueur envoie** — ce qu'il écrit ET ce qu'il lance. Un jet fait depuis la fiche ou depuis l'outil de dés vient s'y inscrire en texte, à côté de ce qu'il tapait. Il n'y a pas de volet séparé à valider.
- [ ] Le champ **grandit avec son contenu**, d'une ligne à huit ; les boutons sont dessous. La hauteur suit la **valeur**, pas la frappe : un jet inséré doit faire grandir le champ comme le clavier le ferait.
- [ ] **Les jets attachés sont au pluriel** : un tour en porte souvent deux, l'attaque puis les dégâts, et ils partent ensemble.
- [ ] Quand un jet est attendu, **c'est le champ qui le dit** : son texte temporaire devient la demande (`Sauvegarde de Dextérité DD 13 — lance depuis ta fiche, ou écris ton résultat`) et sa bordure passe à l'accent.
- [ ] **Deux boutons.** `Jouer` joue le tour et fait avancer l'horloge. `MJ` pose une question de scène ou de règle et **ne touche pas au temps de jeu** — c'est cette différence qui justifie deux boutons plutôt qu'un.
- [ ] **Le moteur devine une question**, et le montre : point d'interrogation ou tournure interrogative en tête de phrase (liste **fermée**, comme le lexique de verbes de V3-B1) → `MJ` passe devant, `Jouer` recule, une ligne l'explique. **Jamais de reroutage silencieux.** Ce que la liste rate tombe du bon côté : une action, donc jamais une horloge qui avance par surprise.
- [ ] Saisie vocale par la reconnaissance du navigateur : gratuit, aucun token, une commodité et rien de plus.
- [ ] Le fil défile automatiquement **sauf si l'on a remonté** — cas classique et systématiquement raté.
- [ ] **Une région `aria-live` polie** annonce chaque nouveau tour : c'est le seul écran du produit où le contenu arrive sans action de l'utilisateur (F‑08 de l'audit).

### V3-D5 — La colonne droite : la fiche jouable · `M`

- [ ] **C'est la fiche jouable, au format étroit** — mêmes composants, aucun code dupliqué. Elle est tenue à 375 px depuis la V1.
- [ ] **Les cinq onglets de la fiche, avec leur vrai contenu** : Actions, Sac, Magie, Traits (« Aptitudes accordées »), Maîtrises (maîtrises, maîtrise d'armes, langues). Rien n'est inventé ici ; seul le format d'affichage change.
- [ ] **Six onglets ne tiennent pas dans 300 px** — le dernier se coupe. Les compétences vivent donc sous les caractéristiques, repliées, là où la vraie fiche les met : elles n'y sont pas un onglet non plus.
- [ ] En tête : le nom, **les états en cours à côté** (`entity_runtime_state.conditions`), la ligne d'identité **avec l'âge** (entrée du bloc `infobox`, il n'a pas de champ typé), la barre de PV, la ligne CA · vitesse · maîtrise · **épuisement · inspiration**, puis **la barre d'XP** avec son seuil de niveau.
- [ ] Les états et l'inspiration **manquent à la vraie fiche** : c'est **V2.1-26**, à faire avant ou avec ce ticket.
- [ ] **Le Sac s'ouvre sur la bourse et la charge** — les deux choses qu'on vient y vérifier en jouant. On y équipe un objet ; dans Magie, on y prépare un sort.
- [ ] **Tout ce qui se lance se clique** : modificateur de caractéristique (un test), sauvegarde, compétence, attaque, dégâts.
- [ ] **Un jet lancé depuis la fiche répond à la demande en cours** (V3-B5) : un seul chemin vers la résolution, jamais deux.

### V3-D6 — Ce qui vient d'où · `S`

*Proposition d'origine, **retenue** après l'esquisse : « les marqueurs sont bien informatifs » (auteur, 22 septembre).*

- [ ] Chaque élément du fil indique discrètement sa source : **préparé** `▪` (écrit avant la partie), **tiré** `⬦` (générateur, avec le dé au survol), **narré** `~` (le modèle).
- [ ] Un jet dit d'où il vient : **depuis la fiche**, **volet de dés**, **annoncé à la main**. La distinction compte : un dé annoncé n'a pas été lancé par le serveur, et le journal doit le savoir.
- [ ] **Le placement reste à régler.** Posé en fin de paragraphe, le marqueur se lit comme une coquille (« il repose sa pinte. ~ »). Essayer en tête de bloc, ou en liseré de bordure, avant de figer.

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

**Tranchées depuis** — gardées ici pour qu'on ne les rouvre pas par mégarde :

| Question | Décision |
|---|---|
| Où vit `SceneState` ? | Table `scene_states`, une ligne par campagne — **fait** (V3-A4, `SCHEMA.md` §26) |
| Comment s'écrit la condition d'un déclencheur ? | Type propre, hors de l'AST numérique — **ADR 0027** |
| Ordre de deux déclencheurs sur le même événement ? | Priorité entière décroissante, égalité par ordre de déclaration (V3-A1) |
| Le jeu hors combat peut-il déclencher ? | Oui — `check_passed`/`check_failed` et l'opérateur `event_has`, **ADR 0028** |
| Un déclencheur peut-il donner une action bonus ? | Oui — effet `grant_budget`, **ADR 0029** |

**Encore ouvertes :**

| Question | Recommandation |
|---|---|
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
