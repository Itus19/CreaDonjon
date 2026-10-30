# Spécification — La mémoire du récit

**Version :** 1.0 — 30 octobre 2026
**Tickets :** lot I de `docs/BACKLOG_V4.md` (`docs/backlog-v4/09-memoire-du-recit.md`) · **ADR :** 0091
**Reprend :** V3-E1 (résumé de scène), V3-E3 (journal de personnage), V3-F1 (reprendre une partie), et s'appuie sur V3-B3 (`buildSoloTurnContext`) et V3-E2 (recherche dans le wiki)
**Amende :** `specs/simulation-monde.md` §15

---

## 0. Le problème, et notre réponse

Les sites qui font jouer un modèle d'IA comme MJ mettent **toute l'histoire dans la fenêtre de contexte**. Au bout de quelques heures, elle déborde ; on résume ou on tronque, le modèle oublie ou croit se souvenir, et le récit devient incohérent. Il n'y a aucune source de vérité hors du texte.

Ici, **la vérité est en base** : fiches, psyché, souvenirs, croyances, journal du monde, journal de séance, quêtes. À chaque tour, le **moteur assemble** un contexte court et pertinent ; le modèle ne fait que **raconter**. Une partie peut durer cent heures : le contexte, lui, ne grossit pas.

Cinq angles morts restent, et ce document y répond : choisir ce qui entre (§1), ce que la narration invente (§2), les fils ouverts (§3), le contrôle après coup (§4), la reprise (§5).

---

## 1. Le contexte assemblé : un contrat

Construit **à chaque tour** depuis l'état courant (principe de V3-B3), par une fonction pure qui reçoit les données déjà filtrées par l'audience (règle 11). Chaque couche a un **ordre**, un **budget** de jetons et une règle de sélection **déterministe** : même état, même contexte.

| Ordre | Couche | Contenu | Sélection | Budget de départ |
|---|---|---|---|---|
| 1 | **Consignes** | rôle du modèle, consignes de récit (`violence_detail`, `tone`, `intimate_narration`, thèmes voilés), ce qu'il n'a pas le droit de faire | fixe | 250 |
| 2 | **Le tour** | les faits établis par le moteur ce tour (jets, issues, réactions des PNJ choisies par le moteur, changements) | tous | 300 |
| 3 | **La scène** | lieu, heure, lumière, météo, présents (`scene_states`) | tous | 150 |
| 4 | **Les présents** | le résumé de chaque figure présente (`specs/psyche-v4.md` §10) | les six plus concernées par le tour | 6 × 110 |
| 5 | **Le PJ** | ce qu'il sait et ressent, selon les réglages de table ; son journal (V3-E3) | ses croyances liées aux présents et au lieu | 200 |
| 6 | **Les souvenirs en jeu** | souvenirs des présents qui concernent le PJ ou ce qui se passe | saillance × lien avec la scène, les meilleurs d'abord | 250 |
| 7 | **Les fils ouverts** | promesses, dettes, menaces, indices, quêtes que la scène touche (§3) | ceux qui impliquent un présent ou le lieu | 150 |
| 8 | **Ce qu'évoque le joueur** | les entités nommées dans la phrase du joueur (`detectEntityReferences`), leur fiche résumée | dans l'ordre d'apparition | 200 |
| 9 | **Le wiki** | passages retrouvés par la recherche (V3-E2) | les plus proches de la scène | 300 |
| 10 | **Le fil récent** | les derniers tours en clair, puis le résumé de scène (§5.1) | les N derniers tours, N mesuré | 400 |

- **Quand une couche déborde**, on coupe **dans cette couche** les éléments les moins bien classés, jamais une autre couche. Les couches 1 à 3 ne sont jamais coupées.
- **Tout contenu venu de la base est encadré** par `fenceUntrustedData` (règle 10), sauf les phrases composées par le serveur à partir de gabarits (comme aujourd'hui).
- **L'audience** (règle 11) : un joueur ne reçoit que ce que son PJ croit, dans la version qu'il croit ; jamais la vérité qu'il ignore, ni une couche réglée « MJ seul ».
- **Les budgets** sont des valeurs de départ ; ils se mesurent sur de vraies parties (le principe de la V3 : « combien de tours garder en clair : à mesurer »). Un test vérifie que le total ne dépasse jamais le plafond du modèle configuré.

---

## 2. Ce que la narration invente : le capter

Le modèle écrit « son frère Dorn tient la forge ». Dorn n'existe pas : sans rien faire, la phrase disparaît au tour suivant, ou se contredit plus tard.

**Décision de l'auteur : capter.** Après chaque récit, une sortie structurée du même appel (ou un second appel court) liste les **affirmations nouvelles** : une personne, un lieu, un objet, un lien, un fait passé. Chacune devient une **proposition** (`ai_proposals`, règle 9), validée par Zod et par le métier :

- **une personne de passage** : l'esquisse de PNJ (V3-C2) existante ; acceptée, elle devient une figure (légère, ou complète si elle est présente) ;
- **un lien ou un fait passé** sur une figure existante (« le frère de Bram ») : une proposition de relation ou de souvenir, **refusée d'office** si elle contredit un fait en base (Bram est fils unique d'après sa généalogie) ;
- **un détail de décor** sans conséquence (« une odeur de pain ») : rien n'est capté.

En solo, les propositions vont dans le tiroir de conséquences ; une proposition sans contradiction et sans conséquence mécanique peut s'appliquer seule (`auto_applied`, déjà prévu), les autres attendent. En campagne, le MJ les relit.

Le modèle ne crée **jamais** un fait de règle (un nombre, une issue) : ceux-là viennent du moteur (règle 8).

---

## 3. Les fils ouverts

Une promesse (« je retrouverai ton fils »), une dette, une menace (« tu me le paieras »), un chantage en préparation, un indice laissé, une quête en cours, une croyance non résolue (« quelqu'un m'a volé ») : si personne ne les tient, ils s'oublient. Le moteur les **tient** :

- `openThreads(campaign)` (pur) : tirés du journal du monde (serments non tenus ni rompus, `blackmail` non soldé, menaces), des rêves qui visent un PJ, des quêtes actives, des croyances à acteur inconnu, des propositions en attente.
- Chaque fil a une **échéance** facultative (une promesse « avant la pleine lune ») ; passée, le fil devient un fait (`oath_broken`) et les figures concernées s'en souviennent.
- La couche 7 du contexte ne prend que les fils que **la scène touche** (un présent, le lieu). Le modèle peut ainsi faire dire à Hesta « Alors, mon fils ? » quand le PJ revient, sans qu'on le lui ait demandé.
- Le joueur voit ses fils ouverts dans le journal de personnage (V3-E3) ; le MJ les voit tous.

---

## 4. Le contrôle après coup

Avant d'afficher un récit, une vérification **déterministe** (`checkNarration(text, turnFacts, knownNames)`, pure) :

1. **Les noms** cités existent (figures, lieux, objets connus) ou sont captés comme affirmations nouvelles (§2) ; un nom qui contredit un identifiant connu (le vrai nom d'un PNJ déguisé, `known_as`) est une fuite.
2. **Les issues** annoncées correspondent aux faits du tour : le récit ne dit pas « tu le tues » quand le moteur dit « raté », ni « il accepte » quand le PNJ a refusé.
3. **Les thèmes voilés** ne sont pas décrits.

Un échec fait **régénérer** le récit une fois, avec la faute signalée au modèle ; un second échec affiche un récit **sobre composé par le serveur** à partir des faits (gabarits), et le tour continue. Rien n'est jamais perdu : les faits sont déjà en base. Chaque échec est journalisé (`ai_usage_log`, règle 13), pour mesurer la fiabilité du modèle utilisé.

La vérification des issues est volontairement **grossière** (liste fermée de verbes d'issue par genre de fait). Elle attrape les contradictions franches, pas les nuances : c'est l'esprit de la V3 (« le moteur devine une question, jamais un reroutage silencieux »).

---

## 5. Résumer et reprendre

### 5.1 Le résumé de scène (V3-E1)

À la fermeture d'une scène (changement de lieu, ou une longue pause en jeu), un résumé court est **composé à partir des faits** de la scène (événements, réactions, souvenirs créés), puis **mis en prose** par le modèle, relu par le joueur en solo. Il remplace les tours détaillés de cette scène dans la couche 10 des scènes suivantes. Le résumé n'est jamais une source de vérité : ce sont les faits qui le sont ; il peut toujours être recomposé.

### 5.2 Le journal de personnage (V3-E3)

Ce que le PJ a appris, promis, refusé, et ce qu'il croit savoir des autres : ses croyances (`specs/simulation-monde.md` §9.7) et ses fils ouverts (§3), mis en page. Il entre dans la couche 5 à la place des faits bruts.

### 5.3 Reprendre une partie (V3-F1)

« Précédemment… » : assemblé depuis les faits (les derniers résumés de scène, les fils ouverts, l'état du PJ, ce qui a changé dans le monde pendant l'absence si la simulation a tourné), puis mis en prose. **Jamais** depuis la mémoire d'un modèle.

---

## 6. Critères d'acceptation de la spec

- [ ] Le contexte d'un tour est une fonction pure de l'état ; même état, même contexte (test).
- [ ] Il ne dépasse jamais son plafond, même après cent heures de jeu simulées (test sur un journal factice volumineux).
- [ ] Aucune donnée hors audience n'y entre (test, comme V3-B3).
- [ ] Une affirmation nouvelle du récit devient une proposition ; une affirmation qui contredit la base est refusée.
- [ ] Un récit qui contredit les faits du tour n'est jamais affiché tel quel.
