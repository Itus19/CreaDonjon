-- V3.1-22 (ADR 0038) — le salon de table, à côté des fils privés.
--
-- Depuis 20260901130001, le chat n'a que des fils privés joueur ↔ MJ :
-- `thread_user_id` (non nul) nomme le joueur du fil, et la RLS ne montre un
-- fil qu'à ce joueur et au MJ. Le salon commun revient dans la MÊME table :
-- `thread_user_id` nul = salon, lisible et écrivable par tout membre de la
-- campagne (joueur ou MJ, `campaign_members`) et par l'administrateur du
-- monde. Les fils privés ne changent pas : un joueur ne lit jamais celui
-- d'un autre.
--
-- `campaign_chat_reads` suit : la date de lecture du salon est une ligne au
-- `thread_user_id` nul. Une clé primaire n'admet pas de nul ; elle devient un
-- index unique `nulls not distinct` (une seule ligne de salon par lecteur),
-- que l'upsert (`on conflict (campaign_id, user_id, thread_user_id)`) vise.
--
-- `related_entity_id` (« Demande de modification », retirée par l'ADR 0038)
-- reste en base : le code ne l'écrit ni ne le lit plus, et la supprimer
-- effacerait le contexte des anciens messages sans rien protéger.

alter table campaign_chat_messages alter column thread_user_id drop not null;

drop policy campaign_chat_messages_select on campaign_chat_messages;
create policy campaign_chat_messages_select on campaign_chat_messages for select
  using (
    case
      when thread_user_id is null then
        app.campaign_role(campaign_id) is not null
        or app.is_world_admin(app.campaign_world_id(campaign_id))
      else
        app.is_world_member(app.campaign_world_id(campaign_id))
        and (thread_user_id = auth.uid() or app.is_world_admin(app.campaign_world_id(campaign_id)))
    end
  );

drop policy campaign_chat_messages_insert on campaign_chat_messages;
create policy campaign_chat_messages_insert on campaign_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and case
      when thread_user_id is null then
        app.campaign_role(campaign_id) is not null
        or app.is_world_admin(app.campaign_world_id(campaign_id))
      else
        app.is_world_member(app.campaign_world_id(campaign_id))
        and (thread_user_id = auth.uid() or app.is_world_admin(app.campaign_world_id(campaign_id)))
    end
  );

alter table campaign_chat_reads drop constraint campaign_chat_reads_pkey;
alter table campaign_chat_reads alter column thread_user_id drop not null;
create unique index campaign_chat_reads_key
  on campaign_chat_reads (campaign_id, user_id, thread_user_id) nulls not distinct;
