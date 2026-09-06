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
```

**A avant B avant C** — ce sont de vraies dépendances, pas une préférence : la boucle a besoin de l'état de scène, et l'écriture du monde a besoin de la boucle.

**D peut commencer en parallèle de C.** L'écran se construit contre des données factices sans rien attendre ; c'est même souhaitable, parce que voir l'écran change la conception du reste.

**E et F attendent une vraie partie jouée.** Concevoir la mémoire longue avant d'avoir joué trois séances, c'est deviner.

---

## S2 — Reboucler le lien fait-mécanique → narration · `S`

**Ce n'est pas un ticket de fonctionnalité, c'est la dette de S1.** L'ADR 0009 le dit explicitement : *« Avant toute conclusion définitive : reboucler spécifiquement le lien fait-mécanique → narration, jamais réellement exercé dans ce spike (panne d'infrastructure sur l'unique tentative). »*

Le combat des tours 2 à 4 du spike a été narré sans qu'aucun dé réel ne soit lancé. La garantie centrale du projet — le modèle ne calcule rien — n'a donc jamais été observée de bout en bout.

- [ ] Réutiliser `/spike-solo`, sans rien reconstruire : dix tours de combat, chacun **obligatoirement** précédé d'une résolution mécanique réelle (`resolveAction`), la case à cocher facultative retirée.
- [ ] Mesurer : le modèle reprend-il fidèlement les nombres fournis (dégâts, PV restants, réussite ou échec) ? Compter les écarts sur dix tours.
- [ ] Mesurer : invente-t-il un fait mécanique absent du contexte (un coup critique, une chute, un PNJ qui intervient) ?
- [ ] Écrire le verdict dans `docs/adr/0009` (amendement daté, jamais une réécriture) ou dans un ADR 0020 si la conclusion change la forme de la V3.

**Seuil d'échec :** plus d'un tour sur dix où un nombre fourni est contredit. Au-delà, la narration doit être encadrée davantage (gabarits à trous plutôt que prose libre) — et ça change le lot B, donc il faut le savoir avant.

---

# Lot A — Le moteur

*Reprend `specs/moteur-de-jeu.md` §8 sans en changer la numérotation. Détail de conception dans la spec ; ici, seulement les critères d'acceptation et ce que la spec laissait ouvert.*

### V3-A1 — Déclencheurs : schéma, évaluateur, bornes · `L`

Le cœur. Fonction pure, aucune base, aucun réseau. **Tests avant le code** — les cas dorés sont des règles réelles.

- [ ] `src/core/rules/triggers.ts` : `zTrigger` (Zod), un évaluateur, rien d'autre.
- [ ] Le `if` réutilise l'AST existant, étendu de `and`/`or`/`not`/`eq`/`gte`/`lte`/`has_condition`/`has_feature`/`in_range` — **aucune grammaire nouvelle**.
- [ ] Vocabulaire d'événements fermé (les 18 de la spec §4). Ajouter un événement = un ADR.
- [ ] Les quatre bornes : profondeur 4, 32 déclencheurs par événement, un même déclencheur une fois par chaîne, 8 effets par déclencheur.
- [ ] Cas doré n° 1 : **la concentration rompue par les dégâts, exprimée entièrement en données**, sans une ligne de code spécifique. C'est le test qui prouve que le mécanisme est le bon.
- [ ] Cas doré n° 2 : deux déclencheurs qui se répondent s'arrêtent à la profondeur 4 avec une erreur explicite, jamais une boucle.
- [ ] `triggers.ts` n'importe rien de `next`, `react` ni `@supabase` (vérifié par la règle ESLint existante).

**Question laissée ouverte par la spec, à trancher ici :** l'ordre d'exécution de deux déclencheurs sur le même événement. Recommandation — une priorité entière déclarée, même mécanisme que les couches de modificateurs de `sheet.ts`, à égalité l'ordre de déclaration. Écrire un ADR si un autre choix est fait.

### V3-A2 — Brancher le vocabulaire d'événements · `M`

- [ ] `resolveAction` et le combat émettent les événements du vocabulaire.
- [ ] Chaque événement porte son contexte (`event.damage`, `event.target`…) accessible à l'AST.
- [ ] Un déclencheur qui échoue est journalisé, jamais silencieux, et n'interrompt pas le tour.

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
