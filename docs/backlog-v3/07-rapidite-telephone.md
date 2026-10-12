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

### ☐ V3-R6 — Les deux chiffres que seul l'auteur peut lire · `S` · sans modèle IA — *audit `P‑05`, `P‑07`* — **`P‑05` refermé le 12 septembre ; `P‑07` diagnostiqué et corrigé le 12 octobre, reste à remesurer**

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
- [x] **Appliquée** (index présents le 12 octobre), puis remesurée. **Les index n'ont rien changé, et le diagnostic était faux** — voir « Mesure du 12 octobre » ci-dessous. Texte d'origine : **à appliquer par l'auteur** (`supabase db push`), puis remesurer avec le même protocole. Attendu : `ruleset_entries` rejoint l'ordre de grandeur des autres tables. Si ce n'est pas le cas, ne pas insister sur les index — refaire un `EXPLAIN ANALYZE` et rouvrir.
- [ ] `P‑08` (listes sans borne) ne se rouvre **que** si une mesure le désigne. Rien ici ne le fait.

**Mesure du 12 octobre : le vrai coupable.** Même protocole que R7, même fenêtre. Une requête pèse 92 % du temps base des règles : **320 appels à 457 ms**, le même ordre que les 421 ms de septembre. Son filtre complet : `WHERE ruleset_id = $1 ORDER BY id LIMIT … OFFSET …`. Ce n'est pas une lecture d'une ligne : `pg_stat_statements` compte une page JSON de PostgREST comme « une ligne », et c'était déjà vrai du chiffre de septembre. C'est **la liste complète d'un ruleset**, page par page (`listRulesetEntries`, appelée par `listRuleEntriesForWorld` : page Règles et route `/rule-entries`).
- Le code demandait la première page (1 000 entrées), puis **9 pages de plus d'office**, en parallèle (V2-G1). Pour le SRD 2024 (~1 900 entrées), 8 revenaient vides, et chacune coûtait quand même ~460 ms : avec `OFFSET`, Postgres parcourt les lignes sautées et évalue la RLS (`can_read_ruleset`) sur chacune. **10 requêtes par liste, dont 8 pour rien.**
- Les index de la migration du 12 septembre n'y pouvaient rien : le coût n'est pas dans la recherche du ruleset, il est dans l'évaluation de la RLS ligne par ligne.

- [x] **Corrigé le 12 octobre** : les pages se lisent une à une, jusqu'à la première incomplète (`rules.listPagination.test.ts`, 5 tests). Pour le SRD 2024 : 2 requêtes au lieu de 10, le même nombre d'allers-retours qu'avant.
- [ ] **Remesurer après déploiement**, même protocole : la requête de liste doit passer de ~10 à ~2 appels par chargement. *Reporté après le 13 octobre : la sortie réseau du mois était à 89 % le 12, plus aucun essai contre la vraie base d'ici là.*
- [ ] Si la liste reste trop chère avec 2 pages : rendre `can_read_ruleset` moins coûteux par ligne (une vérification par requête plutôt que par ligne). C'est un changement de RLS : ADR et Opus, seulement si une mesure le désigne.

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
