# 0018 — Un asset `public` doit rester lisible par un role Postgres `anon`, pas seulement par RLS

**Date :** 2026-09-02
**Statut :** acceptée

## Contexte

En préparant la Phase F2 (Lot I, migration de `entity_portraits` vers `assets`/Storage), test avec un client Supabase vraiment anonyme (clé publique, aucune session) : un `asset` `visibility_level = 'public'` restait invisible.

Deux causes distinctes, empilées :

1. `assets_select`/`assets_bucket_select` (RLS) exigeaient `app.is_world_member(world_id) AND app.visibility_permits(...)`. Mais `app.visibility_permits` court-circuite déjà `true` pour `p_level = 'public'` — c'est le sens même de "public". Le `AND is_world_member` annulait ce cas précis pour un visiteur qui, par définition, n'a aucune ligne dans `world_members`.
2. Une fois ce `AND` retiré pour le cas public, la requête échouait encore : `app.is_world_member`/`app.visibility_permits`/`app.entity_world_id` étaient `revoke ... from public; grant ... to authenticated` — le rôle `anon` n'avait tout simplement pas le droit d'appeler ces fonctions. Postgres évalue **toutes** les politiques permissives applicables à une table pour construire une requête ; si une seule référence une fonction que le rôle appelant ne peut pas exécuter, toute la requête échoue avec `permission denied for function`, même si une autre politique (un simple test de colonne, par exemple) aurait suffi à elle seule. Il n'y a pas de court-circuit implicite entre politiques OR'd sur la permission d'exécuter une fonction.

Ce n'était jamais apparu avant car tout accès vraiment anonyme de l'application passe par `src/server/services/publicShare.ts` (`service_role`, contourne RLS et les grants de fonctions) — **jamais** par une lecture directe de `assets`/`entity_assets` sous RLS normale. Les cartes (Lot I, phases B-F₁) exposent pourtant une image via `/api/assets/[id]`, une route qui, elle, utilise le client de la requête (potentiellement anonyme), pas `service_role` — un bug latent, jamais détecté car aucune vérification précédente ne s'était faite depuis un navigateur vraiment déconnecté (toujours `/apercu`, en session MJ, jamais `/partage` sans session).

## Décision

Deux principes, appliqués ensemble chaque fois qu'une table doit rester lisible par un visiteur anonyme au-delà du chemin `publicShare.ts` :

1. **La politique RLS elle-même** doit avoir une branche explicite pour le cas public, additive (jamais un relâchement de ce qui existe déjà) : `visibility_level = 'public' OR (is_world_member AND visibility_permits(...))`.
2. **Chaque fonction référencée par une politique SELECT d'une table donnée** doit être exécutable par `anon` dès que cette table doit être lisible par un rôle anonyme — même une fonction dont la branche ne serait "logiquement" jamais empruntée pour ce rôle. Vérifié en pratique avec un vrai client anonyme (clé publique, `auth: { persistSession: false }`, aucune session) plutôt que supposé depuis la lecture du SQL seul.

Sans danger d'accorder `EXECUTE ... TO anon` sur `is_world_member`/`visibility_permits`/`entity_world_id` : ces fonctions lisent `auth.uid()` en interne (`null` pour un anonyme) et retournent déjà le résultat correct pour ce cas (`is_world_member` → toujours `false`, `visibility_permits` → `true` seulement si `public`). Le grant rend la fonction *appelable*, il ne change aucun résultat qu'elle produit.

Appliqué à `assets`/`storage.objects` (migrations `20260902110001`, `20260902130001`, `20260902130002`) — corrige au passage le bug préexistant sur les images de carte, découvert par ricochet en préparant les portraits, pas le sujet initial de ce travail.

## Troisième couche, trouvée en testant le vrai lien `/partage/[token]` dans le navigateur (retour utilisateur explicite : « teste aussi le lien de partage public en vrai »)

Les deux corrections ci-dessus rendaient la RLS correcte, vérifié avec un client Supabase direct (sans passer par l'application). Mais un vrai visiteur passe par les routes Next.js, pas par Supabase directement — et `lib/supabase/middleware.ts` redirige **toute** requête sans session vers `/login`, sauf une liste explicite de pages publiques (`/login`, `/signup`, `/auth/*`, `/partage/*`, `/rejoindre/*`). Cette liste ne couvrait pas `/api/assets/[id]` ni `/api/entities/[id]/portrait` — deux routes que le NAVIGATEUR appelle lui-même, séparément, en chargeant chaque `<img src="...">` d'une page `/partage/*` déjà chargée. Résultat concret, avant correction : la page `/partage/[token]/[entitySlug]` se chargeait (HTML correct, sur la liste), mais chaque image redirigeait silencieusement vers la page de connexion (une réponse HTML, jamais une image) — la garde RLS ci-dessus était donc correcte mais jamais atteinte, ce middleware bloquant tout avant elle.

Corrigé en ajoutant `/api/assets/` (prefix) et `/^\/api\/entities\/[^/]+\/portrait$/` à la liste des pages publiques du middleware. Sans danger d'exempter tout `/api/*` de ce redirect-vers-HTML precis : une route API doit de toute façon renvoyer un JSON/statut, jamais une redirection HTML — chaque route sensible (POST/DELETE sur le portrait, par exemple) revérifie déjà elle-même l'authentification et renvoie un 401 JSON propre.

**Leçon methodologique** : verifier une garantie de securite avec un client isolé (script, clé anonyme directe) prouve que LA COUCHE testée est correcte, jamais que le CHEMIN complet (middleware → route → RLS) l'est. La seule verification qui aurait attrapé cette 3e couche du premier coup est celle explicitement demandée ici : charger le vrai lien dans un vrai navigateur, sans session.

## Conséquences

- Avant d'exposer une nouvelle table à un accès anonyme direct (hors `publicShare.ts`), vérifier — avec un vrai client `anon`, pas seulement une lecture du SQL — que chaque fonction citée par ses politiques SELECT est exécutable par ce rôle.
- Ce principe ne s'applique qu'aux tables lues directement par une route qui peut recevoir une requête anonyme (ex. `/api/assets/[id]`). Les tables résolues uniquement à l'intérieur de `publicShare.ts` (service_role) n'en ont pas besoin — la portée reste volontairement étroite, jamais un blanket-grant sur toutes les fonctions de visibilité.
- `relations`/`entity_mentions`/`chunks` partagent le même motif `is_world_member AND visibility_permits` que `assets` avant ce correctif — non touchées ici (aucune route ne les lit directement en dehors de `publicShare.ts` aujourd'hui, vérifié par grep avant d'écrire cet ADR), mais à revisiter avec la même méthode si un futur ticket leur ajoute un tel accès direct.
