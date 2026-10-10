# 0041 — Les écritures du moteur au nom d'un joueur

**Date :** 2026-10-09
**Statut :** acceptée le 10 octobre — **option B** (choix de l'auteur)

## Contexte

Quand un joueur cible un adversaire (V3.1-21), le serveur résout le jet par le moteur, puis doit écrire les PV et les états **d'un participant que le joueur n'a pas le droit d'écrire** (ADR 0040), ou soigner le PJ d'une autre joueuse. Le serveur agit avec le client Supabase **de l'utilisateur** : tout ce que ce client peut écrire, le joueur peut aussi l'écrire lui-même par l'API, avec n'importe quelle valeur. Une fonction `security definer` « appliquer des dégâts » ouverte aux joueurs leur permettrait de mettre un boss à 0 PV. Le seul client qui contourne la RLS, le service role, est **confiné à `publicShare.ts` par la règle absolue 2**.

## Options envisagées

- **A. Un second module privilégié**, `src/server/services/engineWrites.ts`, seul autorisé (avec `publicShare.ts`) à utiliser le service role, qui n'écrit que des changements produits par le moteur dans la même requête. Simple et sûr si le module reste petit — **mais modifie la règle absolue 2** et sa règle ESLint.
- **B. Des changements signés** : le serveur signe (HMAC, `pgcrypto`) chaque changement produit par le moteur ; une fonction `security definer` ne l'applique que si la signature est valide, avec une clé que seuls le serveur et la base connaissent. Garde la règle 2 intacte et la base reste la dernière barrière — plus complexe : une clé à poser hors Git dans la base (réglage manuel, aussi en cible locale) et à faire tourner.
- **C. Le MJ applique** : le jet du joueur crée une proposition que le MJ valide d'un toucher. Aucun privilège nouveau — mais un toucher du MJ par attaque, ce que la décision « tout se résout et s'applique seul » voulait éviter.

## Décision

**B, choisie par l'auteur le 10 octobre.** La règle absolue 2 reste intacte : le service role reste confiné à `publicShare.ts`.

- **La clé.** Elle vit en deux endroits, et nulle part dans Git :
  - côté serveur, la variable d'environnement `ENGINE_SIGNING_KEY` (serveur uniquement, jamais `NEXT_PUBLIC_`, comme les clés d'IA) ;
  - côté base, une table du schéma privé `app_private.engine_signing_keys (id, secret, active)`, sans aucun droit pour `anon` ni `authenticated`, lue seulement par la fonction ci-dessous.

  La poser est un geste manuel, documenté, aussi en cible locale. Deux clés peuvent être actives à la fois : c'est ce qui permet la rotation.
- **Le changement signé.** Le moteur produit un objet fermé : `{ key_id, nonce, issued_at, campaign_id, changes: [{ kind: "participant" | "runtime", id, hp?, temp_hp?, conditions? }] }`. Le serveur le signe en HMAC-SHA256 (`node:crypto`) sur sa forme canonique (clés triées).
- **L'application.** Une fonction `security definer`, `app.apply_engine_change(payload jsonb, signature text)` :
  - recalcule la signature avec `pgcrypto` (`hmac(…, 'sha256')`) et compare ;
  - refuse un `issued_at` de plus de 60 s, et un `nonce` déjà vu (table `app_private.engine_change_nonces`, purgée au-delà d'une heure) : un changement ne se rejoue pas ;
  - n'écrit que les champs listés, sur des lignes de la campagne nommée, dans une transaction.
- **Le client.** Celui de l'utilisateur appelle la fonction. Sans la clé, il ne peut fabriquer aucun changement accepté.

## Conséquences

Bloque V3.1-107 (cibler côté joueur) et le soin d'un autre PJ. Ne bloque ni le MJ, ni le solo, ni les sauvegardes demandées (V3.1-39 : c'est le propriétaire de la cible qui applique), ni les droits des joueurs (ADR 0043).
