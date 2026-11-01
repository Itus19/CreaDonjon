-- V3.1-150 (ADR 0071) : le devoir de journal en trois états, et l'autrice
-- qui ne touche plus que son propre rendu.
--
-- 1. Trois états : `pending` (la page existe, l'autrice l'écrit),
--    `written` (« Devoir fait », définitif), `validated` (le MJ a validé).
-- 2. La modification d'un devoir devient réservée au MJ. Jusqu'ici l'autrice
--    pouvait changer n'importe quelle colonne de son devoir : avec un état
--    `validated`, elle se serait validée elle-même.
-- 3. L'autrice rend son devoir par `submit_journal_assignment`, qui ne fait
--    que cela.
-- 4. `claim_journal_entry_grant` ne sert plus : la page et l'octroi sont
--    désormais créés par le MJ, à l'assignation.

alter table session_journal_entries drop constraint session_journal_entries_status_check;
alter table session_journal_entries
  add constraint session_journal_entries_status_check check (status in ('pending', 'written', 'validated'));

alter table session_journal_entries add column validated_at timestamptz;

drop policy session_journal_entries_update on session_journal_entries;
create policy session_journal_entries_update on session_journal_entries for update
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));

-- « Devoir fait » : un devoir en cours, assigné à l'appelante, qui a sa page.
-- Rien d'autre ne change (ni l'autrice, ni la page, ni la date en jeu).
-- `false` quand les conditions ne sont pas réunies : le service répond alors
-- clairement, sans erreur SQL à interpréter.
create or replace function public.submit_journal_assignment(p_assignment_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = public, app set row_security = off as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  update session_journal_entries
     set status = 'written',
         written_at = now()
   where id = p_assignment_id
     and assigned_to = auth.uid()
     and status = 'pending'
     and entity_id is not null;
  return found;
end;
$$;

revoke execute on function public.submit_journal_assignment(uuid) from public, anon;
grant execute on function public.submit_journal_assignment(uuid) to authenticated;

drop function public.claim_journal_entry_grant(uuid, uuid);
