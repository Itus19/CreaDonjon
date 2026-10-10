# Tester CreaDonjon

**Règle d'or : on ne crée jamais de compte pour tester.** Le projet Supabase sert à la fois à la vraie table et aux tests. Chaque compte créé « pour voir » finit au milieu des comptes des joueuses, et rien ne permet ensuite de les distinguer.

Seule exception : quand c'est la **création de compte elle-même** qu'on teste (`/login` → « Créer un compte », un lien d'invitation). Ce compte-là se supprime tout de suite après, depuis Administration › Comptes, et le compte rendu du ticket le dit.

---

## 1. Les trois niveaux de test

| Niveau | Quoi | Commande | Base ? |
|---|---|---|---|
| **Noyau** | Les fonctions pures de `src/core` : règles, formules, visibilité, permissions. Tests écrits *avant* le code. | `npm run test:core` (quelques secondes) | non |
| **Intégration** | Services, repos, RLS contre une vraie base (`*.integration.test.ts`). | `npm run test` | oui, sinon **sautés** |
| **À la main** | L'app dans un navigateur, avec les comptes du Banc d'essai (§3). | `npm run dev` | oui |

Avant de dire qu'un ticket est fini : `npm run typecheck && npm run lint && npm run test`. Un test d'intégration sauté n'est pas un test passé : le compte rendu le signale.

## 2. Les tests d'intégration : un groupe fixe de 8 comptes

Ils passent tous par `getReusableTestAccount(role)` (`src/server/testUtils/reusableTestAccounts.ts`) : huit comptes `test-pool-…@creadonjon.local` (owner, gm, editor, player, playerB, playerC, outsider, viewer), créés une fois, réutilisés partout.

- **Jamais** de `auth.admin.createUser` dans un test. Il faut un rôle de plus ? On ajoute une ligne dans `ROLE_EMAILS`.
- Un test nettoie **les données** qu'il a créées (mondes, rulesets…), jamais le compte.
- Pourquoi : chaque connexion compte comme un utilisateur actif facturé par Supabase. Les anciens comptes jetables avaient fait déborder le quota.

## 3. À la main : le Banc d'essai

Trois comptes « tag » permanents, dans un monde à eux, **« Banc d'essai »** (`/m/banc-d-essai`, ruleset SRD 5.2.1, créé le 10 octobre) :

| Compte | Rôle dans le Banc d'essai | Sert à tester |
|---|---|---|
| **Testeur MJ** | propriétaire et MJ | outils du MJ, gestion de campagne, « Voir comme » côté MJ |
| **Testeuse A** | joueuse, avec son PJ | la fiche, les jets, ce qu'une joueuse voit et ne voit pas |
| **Testeur B** | joueur, avec son PJ | deux joueurs à la fois : visibilité entre joueurs, initiative, chat |

- **Connexion** : le nom (par exemple « Testeuse A ») et le mot de passe `MANUAL_TEST_PASSWORD` (dans `.env.local`, jamais dans Git). Le script affiche leur numéro (`#1234`).
- **Mise en place**, ou remise à niveau : `npm run test:comptes-manuels`. Le script est idempotent : il ne recrée rien de ce qui existe. Changer `MANUAL_TEST_PASSWORD` puis le relancer change le mot de passe des trois comptes.
- **Les PJ** sont créés sans fiche. La première vérification de l'assistant de création la remplit, puis elle reste d'une fois sur l'autre.
- **Superadmin** : pour Administration et « Voir comme » côté superadmin, utiliser son propre compte. Aucun compte de test n'est superadmin.
- **Ne jouez pas la vraie campagne avec ces comptes**, et ne testez pas dans le vrai monde de la table : tout essai se fait dans le Banc d'essai.

## 4. Parcours de vérification après un ticket

Suivre la ligne de la zone touchée. Chaque étape doit marcher **et** ne rien afficher de travers (charte, mode clair et sombre, téléphone si l'écran est concerné).

| Zone | Parcours |
|---|---|
| **Connexion** | Se connecter en Testeuse A par nom et mot de passe ; se déconnecter ; un mauvais mot de passe est refusé. |
| **Wiki** | En Testeur MJ : créer une entité, ajouter un bloc, mettre un bloc en visibilité MJ. En Testeuse A : le bloc MJ n'apparaît pas, même dans le code source de la page. |
| **Fiche** | En Testeuse A : ouvrir son PJ, un jet de compétence, un repos court, puis un repos long (PV, emplacements, Inspiration si Humain). |
| **Règles** | En Testeur MJ : créer une fiche maison, la modifier (« Modifier »), vérifier l'avertissement de bloc manquant. |
| **Combat** | En Testeur MJ : lancer une initiative avec les deux PJ ; en Testeur B, dans un second navigateur ou une fenêtre privée, suivre le tour. |
| **Comptes** | En Testeur MJ : « Voir comme » Testeuse A depuis Gestion de campagne, puis revenir. |
| **Solo** | Hors Banc d'essai (mode solo réservé au superadmin) : un tour, en vérifiant que les dés viennent du serveur. |

## 4 bis. Les vérifications faites par Claude

Après un ticket qui touche les droits (RLS, route, compte), **Claude vérifie lui-même** sur la vraie base, sans attendre l'auteur : il lance le test d'intégration du ticket, qui se connecte avec les comptes du groupe fixe (§2), crée son monde de test, vérifie, puis le supprime.

```bash
npx vitest run src/server/services/<ticket>Rls.integration.test.ts
```

- **Sans clé publique dans la session cloud** (`NEXT_PUBLIC_SUPABASE_ANON_KEY` absente), Claude passe la clé service comme simple clé d'API, pour ces fichiers seulement : `NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_SERVICE_ROLE_KEY" npx vitest run <fichier>`. Chaque client de ces tests se connecte avec un compte, et c'est la session de ce compte qui fixe ses droits. Une erreur ne peut que faire échouer un refus attendu, jamais le faire passer à tort. Jamais pour toute la suite : d'autres tests utilisent un client non connecté.
- **Après le test**, Claude vérifie qu'aucun monde de test n'est resté.
- Un échec sur un test de droits veut d'abord dire « migration pas appliquée » : Claude le dit, et l'état du registre (`SECURITE.md` §3) reste *en attente*.
- **L'interface** (affichage, clics, mode sombre) reste à l'auteur, sur le Banc d'essai (§3, §4).

## 5. Le ménage des comptes

`npm run audit:comptes` liste les comptes **sans rien supprimer**, rangés par origine :
- le groupe des tests automatiques (à garder) ;
- le Banc d'essai (à garder) ;
- les comptes de démonstration ;
- les anciens comptes jetables (supprimables) ;
- les comptes « tag » sans campagne (à examiner) ;
- les comptes actifs.

Les anciens comptes jetables (`@creadonjon.local`, hors groupe des tests et comptes de démo) se suppriment avec `npm run supprimer:comptes-jetables` : liste d'abord, suppression seulement avec `-- --confirmer` ; un compte superadmin ou propriétaire d'un monde est gardé et signalé.

L'email d'un compte ordinaire n'est jamais affiché. **La suppression reste un geste de l'auteur** (Administration › Comptes), ou de Claude sur une liste d'identifiants validée par l'auteur. Un script ne peut pas distinguer un compte « tag » de test d'un compte de joueuse.

**Ménage du 10 octobre.** 69 comptes → 15.
- Supprimés :
  - les anciens comptes jetables `@creadonjon.local`, avec leurs mondes de test ;
  - les comptes de test passés par des liens d'invitation (« Claude… », « Concurrent », « test », « Compte ») ;
  - les doublons d'invitation jamais connectés et sans campagne.
- Fait en SQL dans l'éditeur Supabase, en un seul bloc « tout ou rien ». Les traces facultatives (journal d'IA, auteur d'un bloc…) sont gardées sans auteur ; une trace obligatoire arrête tout et nomme la table.
- Reste à examiner : le monde « ClaudeLand » (test), dont le propriétaire n'était pas visé.
