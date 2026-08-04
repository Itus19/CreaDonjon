-- V1-C2 — correctif decouvert en verifiant la RLS descendue (migration
-- 20260804150001) : `app.is_world_member` (20260730150001) ne reconnaissait
-- que `worlds.owner_id` et `world_members` — jamais `campaign_members`. Un
-- joueur invite a une campagne (V1-C1, `inviteCampaignMember`) sans ligne
-- `world_members` separee etait donc bloque par la porte EXTERIEURE de
-- chaque politique (blocks_select and., etc.), avant meme que la
-- visibilite fine n'entre en jeu : un joueur de campagne ne pouvait rien
-- lire du tout dans son propre monde de jeu.
--
-- Elargir cette fonction, tres largement reutilisee (blocks/relations/
-- entity_mentions/chunks/assets/share_links/campaigns/...), n'etend
-- l'acces qu'aux joueurs legitimement membres d'une campagne de ce monde —
-- jamais a un tiers. Meme mecanisme anti-recursion que le corps original
-- (security definer : les sous-requetes sur campaign_members/campaigns
-- s'executent hors RLS, pas de boucle avec campaign_members_select qui
-- appelle lui-meme app.is_world_member).
create or replace function app.is_world_member(p_world uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from worlds w where w.id = p_world and w.owner_id = auth.uid())
      or exists (select 1 from world_members m where m.world_id = p_world and m.user_id = auth.uid())
      or exists (
           select 1 from campaign_members cm
           join campaigns c on c.id = cm.campaign_id
           where c.world_id = p_world and cm.user_id = auth.uid()
         );
$$;
