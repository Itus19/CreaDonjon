-- Complete la correction de 20260902110001 : `app.is_world_member` et
-- `app.visibility_permits` etaient revoquees de PUBLIC puis regrantees
-- SEULEMENT a `authenticated` (20260730150001, 20260804150001) -- jamais
-- prevu qu'un role `anon` (visiteur vraiment non connecte) les appelle un
-- jour, puisque l'acces anonyme passait jusqu'ici entierement par
-- `publicShare.ts` (service_role, contourne la RLS ET les grants de
-- fonctions). La politique `assets_select` corrigee dans la migration
-- precedente reference ces deux fonctions dans sa branche OR -- mais
-- meme une branche jamais empruntee logiquement doit rester APPELABLE par
-- le role executant, sans quoi Postgres refuse toute la requete avec
-- "permission denied for function" (verifie en direct avec la cle anon
-- publique, aucune session : echec net avant meme filtrage par ligne).
--
-- Sans danger d'elargir a `anon` : les deux fonctions lisent `auth.uid()`
-- en interne, `null` pour un visiteur anonyme -- `is_world_member` renvoie
-- alors toujours `false`, `visibility_permits` ne renvoie `true` que pour
-- `p_level = 'public'` (son court-circuit deja explicite, voir son propre
-- commentaire). Rien de nouveau n'est permis, seulement rendu APPELABLE.
grant execute on function app.is_world_member(uuid) to anon;
grant execute on function app.visibility_permits(uuid, text, uuid, uuid) to anon;
