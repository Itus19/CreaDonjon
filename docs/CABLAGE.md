# Le câblage de CreaDonjon

**À quoi sert ce document.** Il dit **comment un écran va chercher ses données** : ce qui arrive avec la page, ce qui part après, en combien de vagues, et les règles qui gardent l'application rapide. Les règles C1 à C7 (§4) viennent de mesures (§3), pas d'impressions. La décision est l'ADR 0055.

**Quand le lire :** avant tout ticket qui crée ou modifie un écran, un hook de chargement (`use…` qui fait un `fetch`), une route `/api` lue par un écran, ou un `layout.tsx`. Le skill `deleguer` l'impose à Sonnet.

---

## 1. Trois mots

- **Requête** : un aller-retour entre le serveur Next et la base Supabase. Depuis l'environnement cloud, chacun coûte environ 200 ms.
- **Vague** : un groupe de requêtes qui partent ensemble. Une requête qui attend la réponse d'une autre ouvre une nouvelle vague. **Le temps d'un écran suit à peu près le nombre de vagues multiplié par la latence** (constat de V2.1-20). Dix requêtes en une vague coûtent moins cher que trois en trois vagues.
- **Chargement après affichage** : un composant qui s'affiche vide, puis lance un `fetch` dans un `useEffect`. L'écran se remplit par morceaux, souvent en cascade.

**Rapidité et quotas vont ensemble.** Chaque appel `/api` évité est aussi un appel de fonction Vercel et des requêtes Supabase en moins (`docs/QUOTAS.md`, Q1). Une mesure coûte elle-même du quota : on mesure avant et après une correction, pas à chaque essai (T3).

## 2. Mesurer

Le protocole, à rejouer à l'identique avant et après chaque correction :

```bash
# 1. Le serveur, instrumenté (développement seulement, rien ne change en production)
CREADONJON_MESURE=1 npm run dev > /tmp/mesure/serveur.log 2>&1 &

# 2. Le pilote : Chromium, comptes du Banc d'essai, chaque écran chauffé puis mesuré 3 fois
node scripts/mesure-cablage.mjs /tmp/mesure/marqueurs.jsonl /tmp/mesure/navigateur.json

# 3. Le tableau des requêtes et des vagues, page par page
npx tsx scripts/analyse-mesure.ts /tmp/mesure/serveur.log /tmp/mesure/marqueurs.jsonl
```

- `lib/supabase/measuredFetch.ts` écrit une ligne `[mesure]` par requête Supabase du serveur : origine, départ, durée, chemin. La ligne ne contient jamais de jeton ni de clé.
- `src/core/mesure/vagues.ts` compte les vagues : la plus longue chaîne de requêtes dont chacune part après la fin de la précédente.
- `navigateur.json` donne le délai avant le premier octet (TTFB), le temps jusqu'à un écran stable, et la liste des chargements après affichage.
- **Le mode strict de React double les chargements en développement.** Il monte chaque composant deux fois, donc tout `fetch` lancé dans un `useEffect` part deux fois. Les « chargements après affichage » mesurés ici sont donc plus nombreux qu'en production, où ce double montage n'existe pas. On compare toujours développement avec développement.
- Il faut **comparer les nombres** (requêtes, vagues, chargements) plus que les millisecondes. Le mode développement et la distance entre le conteneur et Supabase gonflent les temps ; en production ils sont plus courts, mais la forme reste la même.

## 3. Les mesures « avant » (11 octobre)

Banc d'essai, mode développement, médiane de 3 passages. Les fiches des PJ sont remplies (Guerrière 1, Clerc 1).

| Écran | Requêtes à la base (dont middleware) | Auth | Vagues | Chargements après affichage | Écran stable |
|---|---|---|---|---|---|
| MJ, accueil du monde `/m/[monde]` | 68 (4) | 7 | 28 | 3 | 6,7 s |
| MJ, fiche du wiki (faction) | 42 (6) | 9 | 14 | 3 | 3,3 s |
| **MJ, fiche de personnage** | **581 (47)** | **53** | **123** | **44** | **23,6 s** |
| MJ, page Initiative | 54 (4) | 7 | 14 | 3 | 5,1 s |
| MJ, fenêtre Initiative (`/api/…/mj/initiative/window`) | 34 (1) | 2 | 10 | — | 3,4 s |
| MJ, fenêtre fiche PJ (`/api/…/entities/…/window`, coquille seule) | 18 (1) | 2 | 5 | — | 0,9 s |
| Joueuse, accueil | 33 (6) | 11 | 11 | 5 | 3,1 s |
| **Joueuse, sa fiche** `/joueur` | **279 (22)** | 30 | **77** | **21** | **16,5 s** |
| **Joueuse, fiche du wiki de son PJ** | **334 (33)** | 40 | **65** | **31** | **12,8 s** |

**Après la correction 1 (§7), le 11 octobre** : les puces, les blocs de règles et le ruleset résolu passent par un chargeur par lots (`lib/chargement/chargeurParLots.ts`). Ils partent en une requête par écran, et ne sont plus redemandés tant que la réponse est fraîche.

| Écran | Requêtes à la base | Vagues | Chargements après affichage | Écran stable |
|---|---|---|---|---|
| MJ, fiche de personnage | 581 → **244** | 123 → **88** | 44 → **11** | 23,6 s → 21,4 s |
| Joueuse, sa fiche | 279 → **204** | 77 → **68** | 21 → **13** | 16,5 s → 15,6 s |
| Joueuse, fiche du wiki de son PJ | 334 → **189** | 65 → **48** | 31 → **12** | 12,8 s → 10,1 s |

Le temps ne baisse presque pas, et la mesure dit pourquoi. Ce qui reste, ce sont trois routes serveur lentes, appelées l'une après l'autre : `sheet` (≈ 6 s), `resolved-ruleset` (≈ 5 s) et `rule-entries` (≈ 4 s). C'est la correction 2.

**Après la correction 2 (§7), le 11 octobre** : `assembleResolvedRuleset` lance ensemble ses quatre lectures qui ne dépendent que du premier lot : catalogue d'armes, traits d'espèce, noms des aptitudes et maîtrises, blocs des aptitudes. `resolveCharacterActionContext` en fait autant pour la fiche, ses blocs et la campagne, puis pour le ruleset et l'équipement. La sortie a été comparée octet par octet sur six sélections (2014 et 2024, multiclassage compris), et un test fige l'ordre des choix restants.

| Écran ou route | Vagues | Écran stable (ou temps de la route) |
|---|---|---|
| Route `sheet` | 26 → **15** | ≈ 5,3 s → **3,6 s** |
| Route `resolved-ruleset` | 18 → **11** | ≈ 4,4 s → **3,2 s** |
| MJ, fiche de personnage | 123 → 88 → **55** | 23,6 s → 21,4 s → **15,5 s** |
| Joueuse, sa fiche | 77 → 68 → **45** | 16,5 s → 15,6 s → **11,4 s** |
| Joueuse, fiche du wiki de son PJ | 65 → 48 → **42** | 12,8 s → 10,1 s → **9,1 s** |
| MJ, accueil du monde | 28 → **19** | 6,7 s → **5,6 s** |

Ce qui reste visible dans les chiffres :
- *Fait le 11 octobre* : `rulesets` était lu 5 fois par appel de route, car `React.cache()` ne joue pas dans une route `/api`. `walkRulesetChain` garde maintenant sa mémoire sur le client Supabase de la requête : `sheet` passe de 42 à 38 requêtes. Le gain est faible sur le Banc d'essai, dont la chaîne n'a qu'un maillon ; il grandit avec un ruleset variante.
- La fiche calcule encore le ruleset deux fois, une fois par la route `sheet` et une fois par `resolved-ruleset`. Les deux partent en parallèle : ce n'est plus le chemin critique, mais c'est une charge serveur en double. Les réunir relève de C1 (correction 1, seconde partie).

**Après la correction 2 bis (§7), le 11 octobre** : la chronologie exacte de la fiche a montré un chemin critique qu'aucun tableau ne montrait. La fiche lançait trois GET `/sheet` identiques au même instant (double montage du mode strict, plusieurs instances). Le serveur les traitait à la file, et le troisième finissait 8 s après le premier. Les demandes simultanées partagent maintenant la même attente.

| Écran | Requêtes à la base | Vagues | Écran stable |
|---|---|---|---|
| MJ, fiche de personnage | 581 → 244 → **160** | 123 → 55 → **30** | 23,6 s → 15,5 s → **7,4 s** |
| Joueuse, sa fiche | 279 → 204 → **161** | 77 → 45 → **29** | 16,5 s → 11,4 s → **≈ 7,8 s** (chronologie) |

**Leçon de méthode** : compter les requêtes ne suffit pas. Il faut aussi relever la **chronologie** d'un écran (qui part quand, qui finit quand) pour voir ce qui fixe vraiment la fin de l'affichage.

**Après les corrections 3 et 4 (§7), le 11 octobre** :
- **Accueil du MJ** : il appelait l'assemblage complet du ruleset pour chaque PJ (catalogue d'armes, traits, aptitudes, choix), seulement pour afficher « Humain — Guerrier 1 ». Il lit maintenant les seuls noms (`resolveEntryNames`), une lecture par ruleset pour tous ses PJ. Libellés comparés sur les 8 PJ des 6 mondes : identiques.
- **Fond commun** : l'historique des jets et les stations de radio ne s'affichent que dans leurs volets. Ils se chargent à la première ouverture, avec les états chargement et erreur de la charte. Les messages non lus restent chargés tout de suite, car leur pastille est visible.

| Écran | Requêtes à la base | Chargements après affichage | Écran stable |
|---|---|---|---|
| MJ, accueil du monde | 68 → **30** | 3 → **1** | 6,7 s → **3,4 s** |
| MJ, fiche du wiki | 40 → **32** | 3 → **1** | 3,3 s → 3,2 s |
| MJ, page Initiative | 54 → **46** | 3 → **1** | 5,1 s |
| Joueuse, accueil | 33 → **24** | 5 → **3** | 3,1 s → 2,9 s |
| MJ, fiche de personnage | 160 → **144** | 9 → **7** | 7,4 s → 7,7 s (écart de mesure) |

Chaque page affichée fait deux appels `/api` de moins : c'est aussi du quota épargné (`docs/QUOTAS.md`, Q1).

**Après les corrections 5 et 6 (§7), le 11 octobre** :
- **Les listes de règles ne transportent plus le texte SRD.** `listRulesetEntries` lisait `source_raw` en entier pour toutes les entrées : 2,45 Mo pour le ruleset 2024. Les quatre lecteurs n'en gardaient que le nom, la classe ou l'espèce parente, ou les caractéristiques d'un monstre. La base n'envoie plus que ces champs (`source_raw->name`…), et seulement pour le type demandé. Les sorties ont été comparées octet par octet sur 26 cas (monstres et états dans les deux éditions et les deux langues, armes, liste des règles de chaque monde).

  | Lecture | Avant | Après |
  |---|---|---|
  | Liste de toutes les règles | 2,45 Mo | 302 ko |
  | Monstres (Initiative, Rencontres) | 2,45 Mo | 63 ko |
  | États (Initiative) | 2,45 Mo | 2 ko |
  | Catalogue d'armes (chaque calcul de fiche avec maîtrise d'armes, deux fois par affichage) | 2,45 Mo | 5 ko |

- **Fenêtre Initiative** : les PJ sont lus en un lot, en même temps que le combat actif (C4).
- **Badge « Prochaine session » de la joueuse** : ses données arrivent avec le layout joueur (C1), au lieu de deux appels `/api` sur chaque page joueuse.

| Écran | Requêtes à la base | Chargements après affichage | Écran stable |
|---|---|---|---|
| MJ, fenêtre Initiative | 34 → **15** | — | 3,6 s → **1,6 s** |
| MJ, page Initiative | 46 → **28** | 1 | 5,1 s → **3,0 s** |
| MJ, fiche de personnage | 144 → **126** | 7 | 7,4 s → **5,4 s** |
| Joueuse, accueil | 24 → **16** | 3 → **1** | 2,9 s → 2,8 s |
| Joueuse, sa fiche | 144 → **118** | 10 → **8** | 7,8 s → **6,2 s** |

Les routes les plus lentes, en temps serveur moyen :

| Route | Temps moyen | Appels par fiche de personnage |
|---|---|---|
| `GET /api/entities/[id]/sheet` | 6,7 s | 3 |
| `POST /api/worlds/[monde]/resolved-ruleset` | 5,6 s | 6 |
| `GET /api/worlds/[monde]/rule-entries` | 4,5 s | 1 |
| `POST /api/worlds/[monde]/reference-chips` | 1,1 s | 26 |
| `POST /api/worlds/[monde]/rule-entry-blocks` | 1,0 s | 5 |

## 4. Les règles

**C1. Les données initiales arrivent avec la page.** Ce dont l'écran a besoin pour son premier affichage est lu par le composant serveur (page ou layout) et passé en props. Pas de `fetch` dans un `useEffect` au montage. Un `fetch` client reste normal pour ce qui suit un geste : un clic, une recherche, un jet.

**C2. Une donnée partagée se charge une fois par écran.** Si plusieurs blocs ont besoin de la même chose (ruleset résolu, puces de référence, blocs de règles), un seul fournisseur la charge et la partage (contexte React, ou props depuis le serveur). Jamais une requête par bloc. Mesuré : la fiche de personnage demande 6 fois le ruleset résolu et lance 26 requêtes de puces.

**C3. Les lectures indépendantes partent ensemble.** Deux lectures dont aucune n'attend l'autre partent en même temps, avec `Promise.all`, dans les layouts comme dans les services. Mesuré : 28 vagues pour l'accueil du MJ.

**C4. Pas de requête par ligne.** Une liste se lit en un lot (`.in("id", ids)`), jamais un `getEntityById` par participant ou par entrée. Mesuré : la fenêtre Initiative lit `ruleset_entries` 20 fois.

**C5. Un changement met à jour son coin d'écran.** Après une écriture : mise à jour locale de l'état, ou `revalidatePath` ciblé. `router.refresh()` relance tout l'arbre serveur de la page, layouts compris ; il ne sert que lorsque tout l'écran dépend vraiment du changement. Jamais `window.location.reload()`.

**C6. Chaque zone a son propre « chargement en cours ».** Une zone lente a son `loading.tsx` ou son `<Suspense>`, avec l'état de chargement de la charte (`docs/CHARTE-UI.md`). Elle ne bloque pas tout l'écran. Pendant le chargement, jamais de valeur provisoire fausse (« PV 0/0 ») ni de clé technique.

**C7. La sécurité ne s'échange pas contre de la vitesse.** Une donnée chargée avec la page passe le même filtrage serveur qu'avant (règle absolue 5). La double vérification de session, dans le middleware puis dans la route, coûte un aller-retour par appel. C'est un choix de sécurité documenté (`lib/supabase/middleware.ts`) : on n'y touche pas sans décision écrite de l'auteur. Un hook de chargement n'a jamais de `catch` silencieux.

## 5. La carte des écrans

Ce qui se charge, quand et où. Une carte à mettre à jour à chaque recâblage.

**Fond commun de toutes les pages du monde.** Il charge après affichage, sur chaque page :
- les jets de dés de la campagne (`dice-rolls`) ;
- la radio (`radio-stations`) ;
- les messages non lus (`chat/unread-count`).

Côté joueuse s'y ajoutent `scheduling/next-session` et `scheduling/open-request`. → C1 : ces données peuvent arriver avec le layout.

**Fiche de personnage** (MJ `/m/[monde]/f/[pj]`, joueuse `/joueur` et `/joueur/wiki/[pj]`) :
- avec la page : la coquille et les blocs ;
- après l'affichage, en cascade :
  - `resolved-ruleset` ×6 ;
  - `sheet` ×3 ;
  - `reference-chips` ×26 ;
  - `rule-entry-blocks` ×5 ;
  - `rule-entries` ×1.

Chaque appel refait la session, le monde et la chaîne de rulesets : d'où `ruleset_entries` ×176, `worlds` ×88 et `rulesets` ×76 pour un seul affichage. → C2 d'abord, puis C1.

**Accueil du MJ** (`/m/[monde]`) : tout arrive avec la page, mais en 28 vagues, avec `ruleset_entries` ×18. → C3.

**Fenêtres d'outil du MJ** : la coquille est chargée par `/api/worlds/[monde]/mj/[outil]/window` après l'ouverture. Initiative : 34 requêtes en 10 vagues, `ruleset_entries` ×20. → C4.

## 6. Le cliquet

`lib/cablage.test.ts` compte, dans `components/`, `app/` et `src/` :

| Motif | Plafond au 11 octobre |
|---|---|
| Fichiers qui chargent après affichage (`useEffect` et `fetch(` dans le même fichier) | 59 |
| `router.refresh()` | 37 |
| `window.location.reload()` | 2 |

Le test échoue si un compte augmente. Une correction qui le fait baisser **abaisse le plafond dans le même commit**. Un nouveau cas vraiment nécessaire se justifie dans son commit et ici.

## 7. Le recâblage (V3.1-62, étape 3)

Dans l'ordre des gains mesurés, une correction par commit, sans changer aucun comportement, avec une mesure après chacune :

1. **La fiche de personnage** : C2, puis C1. *C2 fait le 11 octobre (chargeur par lots) : 44 → 11 chargements après affichage, 581 → 244 requêtes. C1 reste à faire.*
   - Un seul chargement du ruleset résolu par fiche, partagé par tous les blocs.
   - Les puces de référence d'une fiche demandées en une requête.
   - Les blocs de règles en un lot.
   - Cible : moins de 10 chargements après affichage, moins de 100 requêtes.
2. **La route `sheet`** (6,7 s) : trouver où partent ses vagues (`resolveCharacterActionContext`, `assembleResolvedRuleset`) et les mettre en parallèle (C3). *Fait le 11 octobre : 26 → 15 vagues pour `sheet`, 18 → 11 pour `resolved-ruleset`. Reste la chaîne de rulesets relue dans les routes `/api`.*
3. **Le fond commun** : dés, radio, messages non lus et calendrier arrivent avec le layout (C1). *Dés et radio chargés à la première ouverture de leur volet le 11 octobre. Restent les messages non lus et, côté joueuse, le calendrier (`next-session`, `open-request`).*
4. **L'accueil du MJ** : les layouts en parallèle (C3). *Fait le 11 octobre autrement : le vrai coût était l'assemblage complet du ruleset par PJ, remplacé par la lecture des noms seuls (68 → 30 requêtes).*
5. **La fenêtre Initiative** : `ruleset_entries` en un lot (C4). *Fait le 11 octobre : listes réduites aux champs utiles, PJ en un lot (34 → 15 requêtes, 3,6 s → 1,6 s).*
6. **Les `router.refresh()`** remplacés un par un par des mises à jour ciblées (C5).
