-- V1-C3 — l'historique du wiki doit stocker un instantane complet des blocs
-- (SCHEMA.md §15, "entite + blocs, en entier"), y compris ceux que l'auteur
-- de la modification ne peut pas lui-meme lire : depuis V1-C2, la RLS de
-- `blocks` filtre desormais aussi par visibilite fine, donc un joueur qui
-- edite son bloc `inventory` ne recupere plus, via sa propre session, le
-- bloc `statblock` reserve au MJ sur la meme entite — et meme le
-- proprietaire du monde ne recupere pas forcement un bloc `user`/`private`
-- appartenant a quelqu'un d'autre (canSee() ne lui donne pas de passe-droit
-- a ces deux niveaux). Sans un instantane complet, une revision omettrait
-- silencieusement ces blocs, et les restaurer plus tard les ferait
-- disparaitre pour de vrai.
--
-- Meme famille que public.search_entities (20260801110001) : security
-- definer, mais la seule porte reste app.is_world_member — jamais un non-
-- membre du monde. Le contenu n'est jamais renvoye tel quel au client : il
-- n'est consomme que server-side pour construire le jsonb de
-- entity_revisions.snapshot (src/server/services/entityHistory.ts). La
-- lecture de l'historique cote client re-filtre ensuite par visibilite
-- avant tout affichage — ce contournement ne change rien a ce que verra un
-- joueur, seulement à ce que le serveur peut ecrire dans l'instantane.
create or replace function public.entity_blocks_full(p_entity_id uuid)
returns setof blocks
language sql
stable
security definer
set search_path = public, app
as $$
  select b.*
  from blocks b
  join entities e on e.id = b.entity_id
  where b.entity_id = p_entity_id
    and app.is_world_member(e.world_id);
$$;

revoke execute on function public.entity_blocks_full(uuid) from public;
grant execute on function public.entity_blocks_full(uuid) to authenticated;
