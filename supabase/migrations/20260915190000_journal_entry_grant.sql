-- V2.1-15 — le droit de l'autrice d'une entree du Livre de sessions devient
-- un OCTROI EXPLICITE (`entity_grants`) au lieu d'un 6e cas en dur de
-- `app.can_edit_entity`.
--
-- Constat (retour utilisateur) : ce droit etait invisible dans « Octrois
-- d'edition » (l'outil de gestion de campagne) et, surtout, impossible a
-- retirer — aucun geste de MJ ne pouvait reprendre a une joueuse l'edition
-- d'une entree qu'elle avait redigee. Un droit qu'on ne peut pas reprendre
-- n'est pas un droit accorde, c'est une propriete du schema.
--
-- Le mecanisme d'octroi existait deja depuis V2-M3, avec son ecran et son
-- bouton « Retirer ». Il suffisait de s'en servir.

-- 1. Poser l'octroi au moment ou l'autrice commence a ecrire.
--
-- `entity_grants_write` (migration 20260830110001) reste ce qu'elle etait :
-- « ecrire un octroi est un geste de MJ, jamais quelque chose que le
-- beneficiaire s'accorde lui-meme ». Cette fonction est la seule exception,
-- et elle est etroite a dessein — elle ne sait poser qu'UNE ligne, pour
-- l'appelante elle-meme, sur une fiche qu'elle vient de creer, et seulement
-- si un devoir EN ATTENTE lui est reellement assigne. Elle ne prend aucun
-- `user_id` en parametre : il n'y a rien a detourner.
--
-- `granted_by` est le MJ qui a assigne le devoir, pas l'autrice : c'est
-- litteralement ce qui s'est passe, et c'est ce qui rend la ligne lisible
-- dans la liste des octrois.
--
-- L'octroi est pose sans condition, y compris quand l'autrice est un MJ qui
-- s'est assigne le devoir a lui-meme. La ligne est alors redondante avec son
-- droit d'administration du monde (cas 1), mais la regle reste uniforme —
-- « toute entree du Livre de sessions porte un octroi pour son autrice » —
-- et la liste reste complete. Une regle a trous couterait plus cher a lire
-- que cette ligne en trop, qui se retire en un clic.
-- Dans `public` et non `app` : PostgREST n'expose que le schema `public`,
-- et c'est le service qui l'appelle explicitement via `supabase.rpc()` —
-- meme motif exact que `public.soft_delete_entity` (migration
-- 20260902150011), a la difference de toutes les fonctions `app.*`, que
-- seules les politiques RLS consultent.
create or replace function public.claim_journal_entry_grant(p_assignment_id uuid, p_entity_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = public, app set row_security = off as $$
declare
  v_assigner uuid;
  v_world_id uuid;
begin
  select sje.created_by, c.world_id
    into v_assigner, v_world_id
    from session_journal_entries sje
    join campaigns c on c.id = sje.campaign_id
   where sje.id = p_assignment_id
     and sje.assigned_to = auth.uid()
     and sje.status = 'pending';

  if v_assigner is null then
    return false;
  end if;

  if not exists (
    select 1 from entities e
     where e.id = p_entity_id
       and e.entity_kind = 'session_journal'
       and e.created_by = auth.uid()
       and e.world_id = v_world_id
  ) then
    return false;
  end if;

  insert into entity_grants (entity_id, user_id, granted_by)
  values (p_entity_id, auth.uid(), v_assigner)
  on conflict do nothing;

  return true;
end;
$$;

revoke execute on function public.claim_journal_entry_grant(uuid, uuid) from public;
grant execute on function public.claim_journal_entry_grant(uuid, uuid) to authenticated;

-- 2. Reprendre les entrees deja redigees.
--
-- Sans cette reprise, toute autrice d'une entree anterieure perdrait son
-- droit a l'instant ou le 6e cas disparait ci-dessous. `on conflict do
-- nothing` : une entree qui porterait deja un octroi (accorde a la main par
-- le MJ) garde le sien, avec son `granted_by` d'origine.
insert into entity_grants (entity_id, user_id, granted_by)
select sje.entity_id, e.created_by, sje.created_by
  from session_journal_entries sje
  join entities e on e.id = sje.entity_id
 where sje.entity_id is not null
   and e.entity_kind = 'session_journal'
on conflict do nothing;

-- 3. Retirer le 6e cas.
--
-- Miroir SQL de `canEditEntity` (src/core/permissions/canEditEntity.ts),
-- qui perd `isOwnJournalEntry` au meme ticket — les deux implementations
-- restent comparees par `canEditEntityRls.integration.test.ts`. Le cas 5
-- (`entity_kind = 'notes'`) reste, lui : une fiche de notes privee n'est
-- visible d'aucun autre compte, donc aucun MJ n'a d'octroi a lui accorder
-- ni a lui reprendre — le droit implicite y est le seul possible.
--
-- Les blocs suivent sans rien de plus : `blocks_insert`/`blocks_update`
-- appellent deja `app.can_edit_entity(entity_id)`, donc l'octroi couvre le
-- recit exactement comme il couvre la fiche.
create or replace function app.can_edit_entity(p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public, app set row_security = off as $$
  select
    app.is_world_admin(app.entity_world_id(p_entity_id))
    or exists (
         select 1 from campaign_characters cc
         join campaigns c on c.id = cc.campaign_id
         where c.world_id = app.entity_world_id(p_entity_id)
           and cc.entity_id = p_entity_id
           and cc.user_id = auth.uid()
       )
    or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid())
    or exists (
         select 1 from entities e
         where e.id = p_entity_id and e.entity_kind = 'notes' and e.created_by = auth.uid()
       );
$$;
