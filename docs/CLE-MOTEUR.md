# La clé de signature du moteur

V3.1-104, ADR 0041. Quand un joueur cible un adversaire, le moteur (le serveur) écrit les PV et les états de la cible, que le joueur n'a pas le droit d'écrire. Le serveur **signe** ce changement ; la base ne l'applique que si la signature est bonne. La clé vit en **deux endroits**, jamais dans Git, jamais dans un message ni une capture :

1. la base : une ligne de `app_private.engine_signing_keys` (schéma sans aucun droit pour les clients) ;
2. le serveur : les variables `ENGINE_SIGNING_KEY` (la valeur) et `ENGINE_SIGNING_KEY_ID` (son nom).

Sans clé posée, le MJ joue normalement (il écrit directement) ; seul le ciblage par un joueur (V3.1-107) refuse, avec une erreur explicite.

## Poser la clé (une fois)

1. **Fabriquer une valeur**, sur ta machine, sans la coller nulle part ailleurs que dans les deux endroits ci-dessous :
   ```bash
   openssl rand -hex 32
   ```
   Elle fait 64 caractères hexadécimaux. Choisis aussi un nom, par exemple `cle-2026-11`.
2. **Dans la base** : éditeur SQL de Supabase (ou `psql` en cible locale) :
   ```sql
   insert into app_private.engine_signing_keys (id, secret)
   values ('cle-2026-11', decode('<la valeur>', 'hex'));
   ```
3. **Sur le serveur** :
   - Vercel : *Settings → Environment Variables*, `ENGINE_SIGNING_KEY` = la valeur, `ENGINE_SIGNING_KEY_ID` = `cle-2026-11`, puis redéployer ;
   - en local : les deux lignes dans `.env.local` ;
   - l'environnement cloud de Claude Code : les mêmes variables, pour que les tests d'intégration (`engineSigning.integration.test.ts`) s'exécutent au lieu de se sauter.

## Faire tourner la clé

Deux clés peuvent être actives à la fois : on passe de l'une à l'autre sans coupure.

1. Fabriquer une nouvelle valeur et un nouveau nom (`cle-2027-05`), l'insérer dans la base comme ci-dessus : les deux sont actives.
2. Changer `ENGINE_SIGNING_KEY` et `ENGINE_SIGNING_KEY_ID` sur le serveur, redéployer.
3. Une fois le déploiement en ligne, désactiver l'ancienne :
   ```sql
   update app_private.engine_signing_keys set active = false where id = 'cle-2026-11';
   ```
   (ou la supprimer). Un changement signé par elle est alors refusé.

Pour vérifier la rotation avec les tests : pendant que les deux sont actives, poser aussi `ENGINE_SIGNING_KEY_2` et `ENGINE_SIGNING_KEY_ID_2` (l'autre clé) dans l'environnement des tests.

## Si la clé a fuité

Faire tourner immédiatement (ci-dessus), puis désactiver l'ancienne sans attendre. Un changement signé ne vit que 60 secondes et ne se rejoue pas : une clé désactivée ne laisse rien derrière elle.
