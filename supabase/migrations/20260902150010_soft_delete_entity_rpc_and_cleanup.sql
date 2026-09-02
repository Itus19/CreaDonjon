-- Vraie cause, trouvee apres une serie de sondes temporaires (isolees ici
-- en une seule migration de nettoyage) : Postgres exige, pour un UPDATE,
-- que la ligne PROPOSEE satisfasse aussi la politique SELECT de la table
-- (`entities_select`, "deleted_at is null AND is_world_member(...)"), en
-- plus de la politique UPDATE elle-meme — verifie en direct en rendant
-- `entities_update` totalement permissif (`using(true) with check(true)`)
-- sans que ca resolve quoi que ce soit, puis en desactivant entierement
-- la RLS sur `entities` (ca, oui, a resolu le probleme). Poser
-- `deleted_at = now()` rend la ligne invisible pour `entities_select` —
-- Postgres refuse alors l'ecriture elle-meme, quelle que soit la
-- politique UPDATE. Un cas structurel : une politique SELECT qui masque
-- les lignes supprimees entre TOUJOURS en conflit avec une suppression
-- douce faite par un simple UPDATE, quelle que soit la politique UPDATE.
--
-- Correction definitive : la suppression douce passe desormais par une
-- fonction dediee, `security definer` + `row_security = off`, qui
-- contourne ce conflit structurel pour cette seule ecriture -- la
-- verification de droit reste faite explicitement a l'interieur (reutilise
-- `app.can_edit_entity`), jamais relachee.
create or replace function app.soft_delete_entity(p_entity_id uuid)
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

revoke execute on function app.soft_delete_entity(uuid) from public;
grant execute on function app.soft_delete_entity(uuid) to authenticated;

-- Nettoyage : retire tout l'outillage de diagnostic temporaire
-- (20260902150003 a 20260902150009) et restaure `entities_update` a sa
-- vraie politique (la version rendue permissive n'etait que pour isoler
-- la cause) — plus jamais utilisee pour la suppression douce desormais,
-- mais reste la garde reelle pour tout AUTRE UPDATE (renommer, changer le
-- type...).
drop function if exists public.debug_can_edit_entity(uuid);
drop function if exists public.debug_softdelete_probe(uuid);
drop function if exists public.debug_touch_probe(uuid);
drop function if exists public.debug_list_entities_policies();

alter table entities enable row level security;

drop policy if exists entities_update on entities;
create policy entities_update on entities for update
  using (app.can_edit_entity(id))
  with check (app.can_edit_entity(id));
