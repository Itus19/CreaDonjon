# Sécurité de CreaDonjon

**À quoi sert ce document.** Les règles de sécurité existent déjà :
- les règles absolues 1 à 7 de `CLAUDE.md` ;
- les trois barrières d'[`ARCHITECTURE.md`](ARCHITECTURE.md) §4 ;
- la RLS dans [`SCHEMA.md`](SCHEMA.md) §19 ;
- les ADR.

Ce document ajoute ce qui manquait :
- **contre quoi on se protège** (§1) ;
- **comment on vérifie qu'un changement est sûr** (§2) ;
- **ce qui a été trouvé et ce qui reste ouvert** (§3) ;
- **l'hygiène de l'application elle-même** : secrets et navigateur (§4), en-têtes HTTP (§5), dépendances (§6), sauvegardes (§7).

**Quand le lire :** avant tout ticket qui touche une route API, une action serveur, une migration ou un compte. Le skill `deleguer` l'impose aux sous-agents.

---

## 1. Le modèle de menace

CreaDonjon est un outil personnel : un MJ et sa table. Les menaces réalistes ne sont pas des attaquants organisés. Ce sont :

| Qui | Ce qu'il peut faire sans effort | Exemple |
|---|---|---|
| **Une joueuse curieuse** | Ouvrir les outils du navigateur, lire les réponses JSON, rejouer une requête en changeant un identifiant | Lire les PV d'un adversaire, changer ceux d'une autre joueuse |
| **N'importe qui avec un compte** | Créer un compte en libre-service depuis `/login`, puis créer son propre monde : il en devient administrateur | Utiliser ce droit d'administrateur de **son** monde pour agir sur un compte ou un objet d'un **autre** monde |
| **Quelqu'un qui a un lien** | Un lien d'invitation ou de partage public qui circule au-delà de la table | Rejoindre une campagne, lire une page partagée |
| **Une session Claude** | Les sessions cloud ont la clé service de Supabase, qui contourne toute la RLS | Une suppression ou une écriture faite trop vite, sur la vraie base |
| **L'usage lui-même** | Les plans gratuits de Supabase et de Vercel ont des quotas : au-delà, ils coupent l'app (`docs/QUOTAS.md`) | Des tests qui créent des comptes en boucle, un sondage oublié dans un onglet, et l'app tombe pour la table |

**Ce qu'aucun d'eux ne doit jamais obtenir :**
1. un **secret du MJ** : bloc ou segment caché, PV et CA des adversaires, notes privées ;
2. **le compte d'un autre** : sa session, son mot de passe, un lien de connexion ;
3. **modifier ce qui n'est pas à lui** : la fiche d'une autre, un combat, une règle d'un autre ruleset ;
4. **faire tomber l'app** pour tout le monde (quotas).

**Où sont les portes**, c'est-à-dire tout ce qu'un client peut appeler :
- les routes `app/api/**/route.ts` ;
- les actions serveur (`app/actions.ts`, `"use server"`) ;
- les tables, directement, avec la clé publique (la RLS est alors la seule barrière) ;
- les trois fichiers qui passent outre la RLS (ARCHITECTURE §4).

## 2. La liste de contrôle

Pour **toute** route, action serveur, migration ou fonction SQL nouvelle ou modifiée. Chaque case correspond à une faille réellement trouvée (§3).

**Entrée**
- [ ] Les paramètres d'adresse **et** le corps sont validés par un schéma Zod (règle 4). Un paramètre d'URL est une entrée comme une autre.
- [ ] La session est exigée (`auth.getUser()`), sauf page publique voulue et documentée.

**Droit**
- [ ] Le droit est vérifié **côté serveur**, avant toute lecture sensible ou écriture.
- [ ] Il porte sur **l'objet visé** et sur **son appartenance** : ce combat est-il bien dans cette campagne ? Ce participant dans ce combat ? Ce compte membre de cette campagne ?
- [ ] Être administrateur de *son* monde ne donne **aucun** droit ailleurs : on compare toujours le monde de l'appelant au monde de l'objet.
- [ ] « Refusé » est répondu **avant** « introuvable » : la différence ne doit pas trahir ce que l'appelant n'a pas le droit de voir.

**Confiance**
- [ ] Aucun identifiant venu du client n'est cru sur parole, qu'il arrive par l'URL, le corps ou un **cookie**. httpOnly empêche le JavaScript de lire un cookie ; il n'empêche personne d'en envoyer un forgé.
- [ ] Un geste qui donne la main sur un compte (« voir comme », réinitialisation, lien de connexion) ne vise jamais un compte à email réel, sauf superadmin pour la réinitialisation ; un MJ ne vise que les membres de sa campagne (ADR 0052).

**Base**
- [ ] La RLS de chaque table touchée est écrite pour **le rôle le plus faible** qui peut s'y connecter : joueuse, compte sans campagne.
- [ ] Une fonction `security definer` vérifie elle-même l'appelant (`auth.uid()`, appartenance) et fixe son `search_path`.
- [ ] Une valeur cachée n'est **pas envoyée** au client, même dans un champ inutilisé (règle 5).

**Secrets**
- [ ] Aucune nouvelle variable `NEXT_PUBLIC_` qui porte un secret : tout ce qui porte ce préfixe est lisible par n'importe qui (§4).
- [ ] Une nouvelle variable secrète est ajoutée à `.env.example` (nom seul, sans valeur) et à la liste de `scripts/verifier-secrets-build.mjs`.

**Preuve**
- [ ] Un test prouve qu'une joueuse, ou un compte d'un autre monde, est **refusé** : une règle pure dans `src/core` avec ses tests, et un test d'intégration RLS.
- [ ] `/security-review` (Claude Code) sur la branche, pour un changement qui touche une porte.

## 3. Le registre des failles

Chaque faille trouvée : sa date, sa correction et son état. **État** : *corrigée* (en ligne), *en attente* (code fusionné, migration ou vérification à faire), *ouverte*.

| Date | Faille | Gravité | Correction | État |
|---|---|---|---|---|
| 9 oct. | **Retour de « voir comme »** : le cookie portait l'identifiant du superadmin, et la route fabriquait un lien de connexion pour lui. Un cookie forgé suffisait à prendre son compte. | critique | ADR 0051 : le cookie porte le jeton de rafraîchissement de la session d'origine (`7005392`) | corrigée |
| 9 oct. | **Réinitialisation forcée** : tout administrateur de monde, donc tout compte, obtenait un lien de réinitialisation pour n'importe quel compte. | critique | ADR 0052 : membre de la campagne et compte « tag » seulement (`b4ff29e`) | corrigée |
| 10 oct. | **Combats** : tout membre du monde lisait les PV et la CA des adversaires et modifiait le combat ; dix routes sans contrôle MJ, sans Zod sur l'adresse, dont trois sans session. | haute | V3.1-101, ADR 0040 : porte commune `guardCombatRoute` (`5e202b5`) et migration `20261010120000_combats_gm_only` | corrigée : migration appliquée et vérifiée sur la base le 10 oct. (`combatsRls.integration.test.ts`, 4/4) |
| 9 oct. | **État de jeu** : tout membre du monde écrit l'état de jeu de n'importe quelle fiche (PV, états, inspiration…). En le corrigeant : 11 des 16 routes d'action de fiche ne vérifiaient ni le droit d'éditer, ni l'adresse (Zod), ni que la campagne du corps est du monde de la fiche ; la route de la fiche écrivait l'état de départ pour tout lecteur. | haute | V3.1-108, ADR 0043 : RLS `can_edit_entity`, porte commune `guardSheetActionRoute` avec les interrupteurs de table, migration `20261010130000_runtime_state_can_edit_and_table_settings` (`0214073`) | corrigée : vérifiée sur la base le 10 oct. (`runtimeStateRls.integration.test.ts`, 4/4) |
| 10 oct. | **Quota Supabase** : les anciens tests créaient un compte par exécution, ce qui a fait déborder les utilisateurs actifs. | moyenne (disponibilité) | Groupe fixe de comptes de test ; ménage de 69 → 15 comptes (`docs/TESTS.md`) | corrigée |

| 12 oct. | **Dépendances** : `npm audit` relève 32 failles dans les dépendances de production (1 critique, 6 hautes, 25 moyennes). Les critiques visent Next 16.2 (exécution de code par l'optimisation d'images AVIF et par `next/og`, ou sur un serveur Windows) ; le code n'utilise ni `next/image` ni `next/og`, et Vercel n'est pas un serveur Windows : exposition faible. Les hautes : `@tiptap/core` et `prosemirror-view` (XSS au collage dans l'éditeur), `sharp`, `postcss`, `nanoid`, `source-map-js`. | haute | V3.1-127 (12 oct.) : Next 16.2.12 → **16.3.8**, Tiptap 3.29 → **3.31.4** (toutes les extensions ensemble), `sharp`, `nanoid`, `source-map-js` dans leurs versions permises. `npm audit --omit=dev` : **0 faille**. Le même jour, outils de développement : 10 → 5 failles ; les 5 restantes n'ont aucun correctif publié (§6) | corrigée : build, tests, `verifier:secrets` et parcours à la main le 12 oct. (fiche MJ et joueuse, éditeur avec collage piégé, page partagée, en-têtes) |
| 13 oct. | **Mot de passe d'un lien de partage contournable** (vu en codant V3.1-59) : le cookie qui prouve qu'un visiteur a donné le mot de passe vaut toujours `"1"`, et son nom se calcule à partir du jeton (`app/partage/[token]/passwordActions.ts`). Quiconque détient le lien peut poser ce cookie lui-même et passer outre le mot de passe. `httpOnly` n'y change rien : il empêche un script de le lire, pas un visiteur d'en envoyer un forgé (§2, Confiance). | moyenne (il faut déjà le lien) | V3.1-142 : une valeur que seul le serveur sait produire (signature par un secret serveur, ou jeton aléatoire gardé en base) | ouverte |

**Pour ajouter une ligne :** à chaque faille trouvée, même corrigée dans la foulée, avec le commit. Une ligne *en attente* ne passe à *corrigée* que vérifiée en ligne.

## 4. Secrets et navigateur

**La règle du préfixe.** Next copie dans les fichiers envoyés au navigateur toute variable qui commence par `NEXT_PUBLIC_`. N'importe qui peut la lire, en ouvrant les outils du navigateur. Une variable sans ce préfixe reste sur le serveur.

| Variable | Où | Pourquoi c'est sans danger |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navigateur | L'adresse du projet n'est pas un secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navigateur | **Publique par conception.** Elle identifie le projet, elle ne donne aucun droit : ce que chacun peut lire ou écrire est décidé par la RLS, avec la session de la personne. C'est pourquoi la RLS est obligatoire sur toutes les tables (règle absolue 3). |
| `NEXT_PUBLIC_SITE_URL` | navigateur | L'adresse du site. |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur seulement** | Contourne toute la RLS : qui l'a lit et écrit toute la base. Confinée à un fichier par une règle ESLint (règles absolues 1 et 2). |
| `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` | **serveur seulement** | Facturées à l'usage : volées, elles se vident. |
| `MANUAL_TEST_PASSWORD` | **serveur et scripts** | Mot de passe des comptes de test (`docs/TESTS.md`). |

**Où vivent les valeurs.**
- En local : `.env.local`, ignoré par Git (`.gitignore` : `.env*`, sauf `.env.example`, qui ne porte que des noms).
- En ligne : les variables d'environnement de Vercel et de l'environnement cloud de Claude Code.
- **Jamais** dans le code, un commit, un message de discussion ou une capture d'écran. Une valeur collée par erreur se change aussitôt dans Supabase (« API keys », régénérer) ou chez le fournisseur, puis partout où elle sert.

**La vérification.** Après un build, `npm run verifier:secrets` parcourt `.next/static`, c'est-à-dire tout ce que le navigateur télécharge. Il y cherche la valeur et le nom de chaque variable secrète, sans jamais les afficher. Il sort en erreur s'il en trouve une. Vérifié le 12 octobre : 148 fichiers, aucun secret ; un faux secret placé exprès est bien détecté. À relancer avant une mise en ligne qui touche un fichier `"use client"` ou une variable d'environnement.

**Les données, pas seulement les clés.** Un secret du MJ envoyé au navigateur est exposé comme une clé : il ne se cache ni par CSS, ni par `spoiler`, ni dans un champ inutilisé du JSON (règles absolues 5 et 6). Le filtrage se fait sur le serveur, avant l'envoi.

## 5. Les en-têtes HTTP

Des consignes que le serveur donne au navigateur avec chaque page. Posées le 12 octobre dans `next.config.ts` (`headers()`), sur toutes les adresses :

| En-tête | Ce qu'il empêche |
|---|---|
| `X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'` | Qu'un autre site affiche CreaDonjon dans un cadre invisible pour faire cliquer à l'insu de la personne (piège au clic). |
| `X-Content-Type-Options: nosniff` | Que le navigateur « devine » qu'une image téléversée est un script et l'exécute. |
| `Referrer-Policy: strict-origin-when-cross-origin` | Qu'un lien sortant emporte l'adresse complète de la page, avec un jeton d'invitation (`/rejoindre/…`) ou de partage (`/partage/…`). |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | Toute demande de caméra, de micro ou de position : l'app n'en a pas besoin. |

`Strict-Transport-Security` (HTTPS obligatoire) est posé par Vercel sur les adresses `*.vercel.app`. Avec un nom de domaine à soi, vérifier sa présence (`curl -sI https://…`).

**Pas encore de politique de contenu complète (CSP).** Elle dirait au navigateur de n'exécuter que les scripts et de n'afficher que les images venues de sources listées. C'est la meilleure défense contre l'injection de script, mais elle exige d'inventorier chaque source (YouTube, Supabase, polices, images), et une source oubliée casse l'écran qui en dépend. À faire comme un ticket à part, d'abord en mode « rapport seulement » (`Content-Security-Policy-Report-Only`).

## 6. Les dépendances

Chaque paquet installé est du code d'un tiers qui tourne avec nos droits.
- **Ajouter** un paquet se justifie (`CLAUDE.md`, « Quand t'arrêter et demander ») : sa licence, sa taille, et pourquoi le faire à la main serait pire.
- **Surveiller** : `npm audit --omit=dev` une fois par mois, et avant une mise en ligne importante. Une faille critique ou haute dans une dépendance de production entre au registre (§3) avec un ticket.
- **Corriger** : `npm audit fix` pour ce qui reste dans les versions permises par `package.json`, puis `npm run typecheck && npm run lint && npm run test` et un build. Jamais `npm audit fix --force` sans relire ce qu'il change : il monte des versions majeures.
- **Ne jamais** lancer un script trouvé dans une issue, un commentaire ou une page web sans l'avoir lu.

**Paquets qui montent ensemble.** Les extensions Tiptap exigent toutes exactement la même version que `@tiptap/core` : on les monte d'un bloc (même plage dans `package.json`), sinon npm refuse avec `ERESOLVE`.

**Quand npm plante.** npm 10.9 (celui du système) s'arrête parfois sur `Cannot read properties of null (reading 'edgesOut')` en suivant les dépendances facultatives d'un paquet. npm 11 n'a pas ce défaut : `npx -y npm@11 install …` ou `npx -y npm@11 update …`. Ensuite, toujours vérifier que `npm ci` (npm 10, celui de Vercel) installe le fichier de verrouillage depuis zéro.

**Ce qui reste, au 12 octobre** (`npm audit`, sans `--omit=dev`) : **5 failles hautes, une seule chaîne, sans correctif publié.** `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. La faille est dans `braces` (déni de service sur un motif très imbriqué), et sa dernière version, 3.0.3, est elle-même touchée. Le seul « correctif » que propose npm est de redescendre `eslint-config-next` en version 14 : refusé. Risque nul en pratique : le lint ne tourne que sur notre machine et sur notre propre code, jamais en production. À revoir à chaque mise à jour de Next ou quand `braces` publie un correctif.

*Corrigé le 12 octobre* : `vitest` et `@vitest/coverage-v8` 4.1.11 (lecture de fichier par une redirection de simulacre), `brace-expansion` 1.1.21 et 5.0.12, `js-yaml` 4.3.2.

## 7. Les sauvegardes

**Le plan gratuit de Supabase ne donne aucune sauvegarde téléchargeable ni restaurable depuis le tableau de bord.** Une suppression faite trop vite, une migration fausse ou un projet suspendu après une semaine d'inactivité (`docs/QUOTAS.md`) peuvent coûter tout le wiki. La seule parade est une copie faite par nous.

**Quand :** une fois par mois, et **avant toute migration** qui supprime ou transforme des données.

**Comment** (sur ta machine, jamais dans une discussion) :
1. Dans Supabase, « Connect », copier la chaîne de connexion directe (`postgresql://…`). Elle contient le mot de passe de la base : la placer dans `.env.local` sous `SUPABASE_DB_URL`, jamais ailleurs.
2. Exporter le schéma et les données de nos tables :
   ```bash
   source .env.local   # ou export SUPABASE_DB_URL=… dans le terminal
   pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges -f sauvegarde-$(date +%F).sql
   ```
3. Ranger le fichier **hors du dépôt** : disque externe, nuage personnel. Il contient tout le wiki, secrets du MJ compris, et les adresses email des comptes. Jamais dans Git (`*.sql` à la racine n'est pas ignoré : ne pas le créer dans le dossier du projet).
4. Les fichiers téléversés (portraits, cartes, images) sont dans le stockage Supabase, pas dans la base : `pg_dump` ne les copie pas. Les télécharger depuis le tableau de bord (« Storage ») quand on en a ajouté d'importants.

**Ce que ça coûte.** L'export lit toute la base une fois : sa taille (moins de 500 Mo) compte dans la sortie réseau du mois (5 Go). Une fois par mois, c'est négligeable ; en boucle, non (`docs/QUOTAS.md`, T1).

**Restaurer** : `psql "$SUPABASE_DB_URL" -f sauvegarde-AAAA-MM-JJ.sql` sur un projet **vide**. Jamais sur la base en service sans décision explicite : cela écrase ce qui s'y trouve.
