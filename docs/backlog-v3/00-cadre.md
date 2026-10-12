# Backlog V3 — Le cadre commun

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

À lire avant tout ticket V3 : ce que le spike S1 a établi, ce qui existait déjà, l'ordre des lots, et les critères que **chaque** ticket des lots B et C doit tenir.

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
Lot Z    la dette de la fiche         hors séquence — ce que le solo a révélé en la transposant
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
