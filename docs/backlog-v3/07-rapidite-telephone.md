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

### ☐ V3-R8 — Les noms traduits des règles, en dix paquets · `S` · sans modèle IA — **à faire si l'auteur le veut (ouvert le 12 octobre)**

**Modèle conseillé : Opus** — touche la lecture des règles, au cœur du projet, et sa vérification se fait contre la vraie base.

Sous-tâches Haiku : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Le constat (mesure de V3-R6, 12 octobre).** Après la correction de la liste paginée, la requête la plus chère des règles est la lecture des **noms traduits** : 377 appels × 69,7 ms = 26,3 s sur le parcours de 36 pages. `listRuleEntriesForWorld` lit la liste complète (~1 900 entrées), puis `listTranslationsForEntries` demande leurs traductions **par paquets de 200 identifiants** (`TRANSLATION_BATCH_SIZE`, pour qu'une liste `in (...)` tienne dans une adresse) : 10 requêtes par chargement de liste.

**La piste.** Lire la traduction **dans la même requête que la liste**, par une jointure PostgREST (`ruleset_entry_translations(name)` filtrée sur la langue), au lieu d'une seconde série de requêtes. 0 requête de plus au lieu de 10.

**À vérifier avant de coder.** Que la jointure garde la pagination exacte de la liste (une ligne par entrée, même avec plusieurs langues), et le coût de la RLS de `ruleset_entry_translations` dans la jointure. Mesurer avant et après, même protocole que V3-R6, compteur de sortie réseau sous 80 % (`docs/QUOTAS.md`, T3).

**Critères d'acceptation**
- [ ] La liste des règles d'un monde, avec ses noms traduits, en 2 requêtes au lieu de 12 (test unitaire avec faux client, comme `rules.listPagination.test.ts`).
- [ ] Les mêmes noms qu'avant, en français et en anglais (comparaison sur un monde réel).
- [ ] Mesure avant / après écrite ici.
- [ ] `npm run typecheck && npm run lint && npm run test` passent.
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
