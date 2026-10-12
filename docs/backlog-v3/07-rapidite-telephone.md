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

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

**Terminés** (dans [`termines.md`](termines.md)) : V3-R0, V3-R1, V3-R2, V3-R3, V3-R4, V3-R5.

---

### ☐ V3-R6 — Les deux chiffres que seul l'auteur peut lire · `S` · sans modèle IA — *audit `P‑05`, `P‑07`* — **`P‑05` refermé le 12 septembre**

**Modèle conseillé : Sonnet** — reste une mesure chez l'auteur (P‑07), presque pas de code.

Sous-tâches Haiku : aucune : il reste une mesure dans le tableau de bord Supabase, chez l'auteur.

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

### ☐ V3-R7 — Deux boucles qui rechargent les règles une par une · `M` · sans modèle IA — **fait le 13 septembre**

**Modèle conseillé : Sonnet** — regrouper des lectures en une requête.

Sous-tâches Haiku : aucune : il reste une mesure dans `pg_stat_statements`, chez l'auteur.

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
