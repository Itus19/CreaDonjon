-- Suite immediate de 20260902150010 : `app.soft_delete_entity` n'est pas
-- appelable via `supabase.rpc()` -- PostgREST n'expose que les fonctions
-- du schema `public` (verifie en direct : PGRST202, fonction introuvable
-- dans le cache de schema). Toutes les autres fonctions `app.*` de ce
-- projet ne sont jamais appelees directement par le client, seulement
-- consultees automatiquement par Postgres a l'interieur des politiques
-- RLS -- premiere fonction de ce genre que le client doit appeler
-- explicitement, elle doit donc vivre dans `public` comme le reste de la
-- surface exposee (tables, autres RPC).
drop function if exists app.soft_delete_entity(uuid);

create or replace function public.soft_delete_entity(p_entity_id uuid)
returns boolean
language plpgsql security definer set search_path = public, app set row_security = off as $$
begin
  if not app.can_edit_entity(p_entity_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update entities set deleted_at = now() where id = p_entity_id and deleted_at is null;
  return found;
end;
$$;

revoke execute on function public.soft_delete_entity(uuid) from public;
grant execute on function public.soft_delete_entity(uuid) to authenticated;
