-- V3.1-41 (ADR 0037) — une page du cahier partagée avec la table devient sa
-- propre entité (`entity_kind = 'shared_note'`). Son autrice l'écrit grâce à
-- un OCTROI explicite (`entity_grants`), que le MJ voit et peut reprendre dans
-- « Octrois d'édition », comme pour le Livre de sessions (20260915190000).
--
-- `entity_grants_write` reste un geste de MJ. Cette fonction est la seule
-- exception, étroite à dessein :
-- - elle ne pose qu'UNE ligne, pour l'appelante elle-même (aucun `user_id`
--   en paramètre, rien à détourner) ;
-- - sur une entité `shared_note` qu'elle a créée, dans un monde dont elle est
--   membre ;
-- - et seulement tant que cette entité n'a AUCUN bloc, c'est-à-dire dans
--   l'instant qui suit sa création, avant que le texte n'y soit écrit.
--   Une fois la page écrite, l'octroi ne se réclame plus : un octroi que le
--   MJ a retiré ne peut pas être repris par l'autrice.
--
-- `granted_by` est l'autrice : personne d'autre n'a accordé ce droit, et
-- c'est ce que la liste des octrois doit dire.
create or replace function public.claim_shared_note_grant(p_entity_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = public, app set row_security = off as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if not exists (
    select 1 from entities e
     where e.id = p_entity_id
       and e.entity_kind = 'shared_note'
       and e.created_by = auth.uid()
       and e.deleted_at is null
       and app.is_world_member(e.world_id)
  ) then
    return false;
  end if;

  if exists (select 1 from blocks b where b.entity_id = p_entity_id) then
    return false;
  end if;

  insert into entity_grants (entity_id, user_id, granted_by)
  values (p_entity_id, auth.uid(), auth.uid())
  on conflict do nothing;

  return true;
end;
$$;

revoke execute on function public.claim_shared_note_grant(uuid) from public;
grant execute on function public.claim_shared_note_grant(uuid) to authenticated;
