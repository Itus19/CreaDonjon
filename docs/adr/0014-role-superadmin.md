# 0014 — Rôle superadmin : fonction RLS dédiée, pas le client `service_role`

**Date :** 2026-08-30
**Statut :** acceptée

## Contexte

Le Lot M (`docs/BACKLOG_V2.md`) introduit un compte superadmin unique (Gabriel), seul à disposer du mode solo et, dans les tickets suivants (V2-M4/M5), seul à devoir voir/gérer les comptes et accès de tous les mondes — une vue qui traverse la logique habituelle d'appartenance (`app.is_world_member`), par nature.

Deux façons de construire ce contournement, et le choix engage tout le reste du lot.

## Options envisagées

- **A. Étendre le client `service_role`** (déjà utilisé, confiné à `src/server/services/publicShare.ts`) aux besoins du superadmin. Avantage : contourne toute la RLS sans y toucher. Inconvénient : viole directement la règle absolue 4 ter du `CLAUDE.md` — ce client est *confiné* à un seul fichier précisément pour que la RLS reste la dernière barrière testable ; l'élargir revient à démanteler cette barrière pour tout ce qui passerait par lui, pas seulement pour le superadmin.
- **B. Une fonction SQL dédiée `app.is_superadmin()`**, `security definer`, même patron que `app.is_world_member()` (migration `20260730150001_rls.sql`) — ajoutée en `or` dans les politiques RLS qui doivent un jour laisser le superadmin passer. Avantage : reste dans le modèle de sécurité existant (RLS = filet testé, PDD §28), aucune nouvelle surface de contournement. Inconvénient : chaque politique concernée doit être réécrite une à une (V2-M4/M5), jamais un contournement global en un seul point.

## Décision

**Option B.** `profiles.account_role` (`'member' | 'superadmin'`) et `app.is_superadmin()` sont posés dès V2-M2 (migration `20260830090001_superadmin_role.sql`), avant tout usage réel — les politiques RLS qui en ont besoin (visibilité cross-monde du superadmin) seront réécrites une à une dans V2-M4/M5, jamais par un client `service_role` élargi.

Un seul compte passe à `superadmin`, à la main, dans la migration elle-même (par email, `where id = (select id from auth.users where email = '...')`) — aucune interface de self-service pour ce champ. Promouvoir un deuxième compte exige une nouvelle migration, jamais un bouton dans l'application.

Côté application (TypeScript), les décisions métier ponctuelles (« ce compte peut-il créer un monde en solo ? ») ne passent PAS par un appel RPC à `app.is_superadmin()` : une lecture directe de `profiles.account_role` (`isSuperadmin`, `src/server/services/account.ts`), sous la RLS `profiles_select` déjà restreinte à sa propre ligne, suffit et évite l'aller-retour RPC (qui aurait en plus exigé une enveloppe `public.*`, `app.*` n'étant pas exposé par PostgREST — voir `20260801160002_delete_own_account_public_wrapper.sql` pour ce motif ailleurs dans le dépôt). `app.is_superadmin()` reste réservé aux politiques RLS, qui elles ne peuvent pas appeler du TypeScript.

## Conséquences

- Le client `service_role` reste confiné à `publicShare.ts`, sans exception — la garantie de la règle 4 ter n'est jamais affaiblie par ce lot.
- Deux façons de vérifier "superadmin" coexistent délibérément : `app.is_superadmin()` (SQL, dans les politiques RLS) et `isSuperadmin()` (TypeScript, lecture directe de table, dans les services). Ce n'est pas une duplication de logique à corriger — ce sont deux couches qui ne peuvent pas s'appeler l'une l'autre, chacune avec un seul point d'appel canonique dans sa couche.
- V2-M4/M5 devront modifier chaque politique RLS concernée individuellement (`or app.is_superadmin()`), jamais un seul point de bascule global — plus de travail, mais chaque extension reste visible et testable politique par politique, comme le reste de la RLS du dépôt.
- Promouvoir un deuxième superadmin restera toujours un geste délibéré (nouvelle migration), jamais accidentel.
