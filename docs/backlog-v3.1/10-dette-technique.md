# Backlog V3.1 — Dette technique (V3.1-120…)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Ce qui ne se voit pas à l'écran mais rend le code fragile à modifier. Relevé par des audits ponctuels (ADR 0054), pas en jouant.

---

V3.1-120, 126 et 142 sont dans [`termines.md`](termines.md).

---

### ☑ V3.1-145 — Les tests d'intégration se suppriment les mondes entre eux · `S` · sans modèle IA — **prêt**

**Modèle conseillé : Opus** — touche la discipline de test, pas une fonctionnalité.

**Sous-tâches Haiku** (`aide-haiku`) : recenser, dans `src/**/*.integration.test.ts`, chaque `delete().eq("owner_id", …)` et `delete().eq("created_by", …)` d'un `afterAll`/`beforeAll`, avec le fichier et la ligne.

**Constat** (25 octobre, en clôturant V3.1-65). `npm run test` complet fait échouer `src/server/services/genealogy.integration.test.ts` sur `insert or update on table "entities" violates foreign key constraint "entities_world_id_fkey"`, dans son montage. **Le même fichier passe seul** (2/2). Ce n'est donc pas une régression du code testé.

Tous ces fichiers partagent le même compte de test (`docs/TESTS.md` : jamais de compte neuf) et nettoient en supprimant **par `owner_id`** — c'est-à-dire les mondes des autres fichiers en même temps que les leurs. Tant que le nettoyage d'un voisin tombe pendant le montage de celui-ci, le monde disparaît entre sa création et l'insertion de ses fiches.

**Pourquoi ça compte** : la suite complète rend un échec rouge qui n'en est pas un. Un échec qu'on apprend à ignorer est un échec qu'on n'ira pas lire le jour où il est vrai.

**Piste** (à trancher au ticket, pas ici) : nettoyer par les identifiants réellement créés par le fichier plutôt que par `owner_id`, ou sérialiser pour de bon les fichiers qui touchent `worlds`. Ne pas créer de compte de test par fichier (`docs/QUOTAS.md`).

**Critères d'acceptation**
- [x] `npm run test` passe deux fois de suite sans échec de montage (7e5cc068 : 3998 tests ; f2e4cb6c : 4005 tests, 17 novembre).
- [x] Aucun fichier d'intégration ne supprime une ligne qu'il n'a pas créée (revue du recensement Haiku).
- [x] Aucun compte de test nouveau.

*Fait le 17 novembre.* Recensement : 14 fichiers nettoyaient par `owner_id`, `created_by`, `gm_user_id`, `user_id` (journaux d'IA) ou par un motif de nom. Depuis, la suite tourne fichier par fichier (`fileParallelism: false`) : le risque restant venait de deux exécutions simultanées sur les mêmes comptes (une autre session, un test lancé seul pendant la suite complète — arrivé le 16 novembre). Tous passent par `cleanupCreated` (`src/server/testUtils/cleanupCreated.ts`) : mondes par identifiant, rulesets par lignée, journaux d'IA depuis le début du fichier ; règle écrite dans `docs/TESTS.md` §2. Les 14 fichiers passent, et le compte « owner » ne garde aucun monde ni ruleset après eux. Le premier critère se vérifie par deux suites complètes consécutives (celle de ce commit et la suivante).
