-- V2-M7c (Lot M) — bug decouvert en verifiant le journal cote joueur avec un
-- vrai compte de test : `profiles_select` (migration 20260730150001, jamais
-- elargie depuis sauf pour le superadmin en M6) restait bornee a
-- `id = auth.uid()`. Resultat : le journal fusionne (M6/M7/M7c) affichait
-- "Compte sans nom" pour TOUTE revision/evenement dont l'auteur n'est ni le
-- viewer ni le superadmin — y compris le MJ normal consultant le journal de
-- son propre monde (M7), pas seulement le cas rare superadmin.
--
-- Elargit a "partage au moins un monde avec moi" (proprietaire, membre du
-- monde, ou membre d'une campagne de ce monde — memes trois cas que
-- `app.is_world_member`) : jamais un tiers hors de tout monde commun.
-- Strictement moins revelateur que ce qui est deja visible ailleurs (le
-- panneau "Membres" d'une campagne affiche deja l'UUID brut de chaque
-- membre a n'importe quel co-membre) — un nom lisible remplace un UUID deja
-- expose, rien de nouveau n'est expose.
create or replace function app.shares_world_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  with my_worlds as (
    select id from worlds where owner_id = auth.uid()
    union
    select world_id from world_members where user_id = auth.uid()
    union
    select c.world_id from campaign_members cm join campaigns c on c.id = cm.campaign_id where cm.user_id = auth.uid()
  ),
  their_worlds as (
    select id from worlds where owner_id = p_user_id
    union
    select world_id from world_members where user_id = p_user_id
    union
    select c.world_id from campaign_members cm join campaigns c on c.id = cm.campaign_id where cm.user_id = p_user_id
  )
  select exists (select 1 from my_worlds intersect select 1 from their_worlds);
$$;

revoke execute on function app.shares_world_with(uuid) from public;
grant execute on function app.shares_world_with(uuid) to authenticated;

drop policy profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or app.is_superadmin() or app.shares_world_with(id));
