# 0061 — L'identité de l'application : une ligne unique, lisible par tous

**Date :** 2026-10-13
**Statut :** acceptée (V3.1-84)

## Contexte

L'écran-titre, la tête du rail et l'onglet du navigateur affichent le nom, la phrase et le logo de l'application (« Antre Nous », « Le repaire de ta table. », d20, décision de l'auteur du 9 octobre). Le superadmin peut les changer, et téléverser son propre logo. L'écran-titre les lit **avant toute connexion**. Rien de cela n'existait en base.

## Options envisagées

- **Où vit l'identité.** A : une table à ligne unique. B : un fichier de configuration ou des variables d'environnement, qui exigeraient un redéploiement pour changer un nom. A.
- **Les douze logos au trait.** A : des SVG du code, seule leur clé est stockée. B : des fichiers en base. A : un logo du code ne peut porter aucun script, et Zod refuse toute clé inconnue.
- **Le logo téléversé.** A : dans le stockage, derrière l'interface `storage.ts` (règle absolue 24, cible locale). B : en base, dans une colonne binaire. A, comme toute image.
- **Comment le servir.** A : une URL signée par visiteur. B : une route qui le sert avec un long cache, et dont l'adresse change à chaque version. B : un visiteur le télécharge une fois par version, et le CDN une fois par région (`docs/QUOTAS.md`, egress).
- **Comment lire sans session.** A : le client à cookies de la requête. B : un client anonyme sans cookie, mis en cache entre les requêtes. B : la donnée est la même pour tous, et `unstable_cache` ne peut pas lire les cookies.

## Décision

A, A, A, B, B.

- Table `public.app_identity`, une ligne au plus (`id boolean primary key check (id)`) : `name` (1 à 32), `tagline` (80), `logo_key` (une des douze), `logo_storage_path` (facultatif), `updated_at`, `updated_by`. **Aucune ligne : les valeurs par défaut** de `src/core/brand/identity.ts`. « Rétablir » supprime la ligne.
- **RLS** : lecture pour `anon` et `authenticated` ; insertion, mise à jour et suppression pour le superadmin (`app.is_superadmin()`). Le service vérifie aussi le rôle (`isSuperadmin`) avant d'écrire.
- **Le logo téléversé** va dans un bucket privé à part, `brand` : il n'appartient à aucun monde, donc la règle du bucket `assets` (dossier = monde) ne s'y applique pas. Lecture pour tous, écriture au superadmin.
- **Contrôle du logo** :
  - le type est lu dans la **signature** du fichier (PNG, WebP), jamais dans l'extension : un SVG renommé en `.png` est refusé ;
  - il doit être carré, d'au moins 512 px, et peser 900 Ko au plus (sous la limite de 1 Mo des actions serveur de Next) ;
  - il est **réencodé** en WebP 512 px par `sharp`. Ce qui part en stockage est toujours une image produite par le serveur.
- **Lecture** : `getAppIdentity()` (`src/server/services/appIdentity.ts`, sans `sharp`, importable par le layout racine) passe par un client anonyme. Elle est mise en cache une heure, et invalidée par `updateTag("app-identity")` à chaque écriture.
- **Écriture** : `updateAppIdentityAction` et `resetAppIdentityAction` (`app/appIdentityActions.ts`), entrée Zod (`appIdentityFormSchema`). Le travail se fait dans `src/server/services/appIdentityWrite.ts`.
- **Le logo servi** : `GET /api/app-identity/logo?v=<version>`, ouvert aux visiteurs anonymes par le middleware. Il a un cache d'un an quand `v` est la version en cours, de cinq minutes sinon, et l'en-tête `nosniff`.

## Conséquences

- Une migration, `20261013120000_app_identity` : la table, ses règles, le bucket et ses règles.
- Ce que l'identité coûte en quota : au plus une lecture de la table par heure et par instance serveur. Le logo est servi une fois par version et par région du CDN.
- Les valeurs par défaut sont en français, pour toutes les langues. La phrase est une marque, choisie par l'auteur, et pas un libellé d'interface à traduire. Si l'interface anglaise en veut une autre, ce sera un ticket.
- Les douze logos sont dessinés par les tickets qui les affichent (V3.1-86 : rail, onglet, favicon ; V3.1-88 : la grille de l'administration). Ce ticket ne pose que leurs clés.
