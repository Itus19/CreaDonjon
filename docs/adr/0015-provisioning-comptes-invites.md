# 0015 — Un deuxième trou confiné pour le client service-role, jamais l'élargissement du premier

**Date :** 2026-08-30
**Statut :** acceptée

## Contexte

V2-M4 (`docs/BACKLOG_V2.md`, Lot M) doit créer, au premier clic sur un lien d'invitation, un compte `auth.users` pour un ami — sans qu'il voie jamais d'email ni de mot de passe. Créer un compte pré-confirmé (`email_confirm: true`) et générer un lien de connexion magique (`auth.admin.generateLink`) sont des opérations de l'API admin GoTrue, qui exigent la clé `service_role` : aucune fonction SQL `security definer` ne peut les remplacer, contrairement à `is_world_member`/`resolve_share_link`/etc. (`auth.users` est géré par GoTrue, pas par une table ordinaire manipulable en SQL nu).

Le dépôt a déjà un client service-role (`lib/supabase/service.ts`), confiné par une règle ESLint à son seul importateur, `src/server/services/publicShare.ts` (CLAUDE.md, règle absolue 4 ter). La question : réutiliser ce trou existant, ou en ouvrir un deuxième ?

## Options envisagées

- **A. Étendre `lib/supabase/service.ts`/`publicShare.ts`** pour y ajouter aussi la création de comptes. Avantage : un seul trou à surveiller. Inconvénient : `publicShare.ts` et son client sont documentés, dans leur propre commentaire, comme réservés à « la lecture publique de partage » — y ajouter la mutation d'`auth.users` est précisément « élargir sa portée », l'interdiction jumelle de « ne jamais l'importer ailleurs » dans la règle 4 ter. Ça dilue aussi l'auditabilité : un seul fichier gérerait alors deux risques de nature différente (fuite de lecture vs création de comptes).
- **B. Un deuxième trou, tout aussi étroit** : un nouveau client (`lib/supabase/serviceAccountProvisioning.ts`), confiné par sa propre règle ESLint à un seul nouveau fichier (`src/server/services/accountProvisioning.ts`), dont le rôle est explicitement borné à « provisionner/réclamer un compte invité ». Avantage : chaque trou reste single-purpose et son usage réel tient dans un seul fichier court, aussi facile à auditer que le premier. Inconvénient : une règle ESLint de plus à maintenir.

## Décision

**Option B.** `lib/supabase/service.ts` et `publicShare.ts` restent inchangés, avec leur portée d'origine. Un deuxième trou, structurellement identique (même règle `no-restricted-imports`, même discipline de commentaire), est ouvert pour `src/server/services/accountProvisioning.ts` seul.

## Conséquences

- Deux fichiers, et deux seulement, peuvent jamais construire un client qui contourne la RLS : `publicShare.ts` (lecture de partage) et `accountProvisioning.ts` (comptes invités). Chacun garde une portée que son propre commentaire de tête décrit précisément.
- `accountProvisioning.ts` ne doit jamais servir à autre chose que la séquence provisionner-compte → réclamer-personnage/rôle → générer-lien-magique. Toute autre lecture/écriture après l'établissement de la session passe par la session RLS normale de l'ami, jamais par ce client.
- Un troisième besoin de contournement RLS, plus tard, ouvrirait un troisième trou du même type plutôt que d'élargir l'un des deux existants — c'est le principe reconductible que cet ADR établit.
