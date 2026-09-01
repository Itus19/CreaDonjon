-- V2-M13 (retour utilisateur, 1 sept.) : "évidemment que pour le MJ il y a
-- une fenêtre de chat par joueur" — le salon unique de la migration
-- 20260901120001 devient un salon PAR JOUEUR (MJ + ce joueur seul) :
-- `thread_user_id` identifie le fil (toujours l'id du JOUEUR concerne,
-- jamais celui du MJ qui peut ecrire dans plusieurs fils). Une seule
-- migration ALTER plutot que redroper les tables (rule 10, jamais modifier
-- une migration deja appliquee) : la ligne de test existante est
-- backfillee sur son propre expediteur, seule valeur plausible disponible.

alter table campaign_chat_messages add column thread_user_id uuid references auth.users(id);
update campaign_chat_messages set thread_user_id = sender_id where thread_user_id is null;
alter table campaign_chat_messages alter column thread_user_id set not null;

-- "Demande de modif au MJ" (retour utilisateur) : un message peut porter la
-- fiche depuis laquelle il a ete envoye — nul pour un message de chat
-- ordinaire, jamais utilise pour filtrer/securiser (juste un contexte
-- affiche, meme statut qu'un lien classique).
alter table campaign_chat_messages add column related_entity_id uuid references entities(id) on delete set null;

drop policy campaign_chat_messages_select on campaign_chat_messages;
create policy campaign_chat_messages_select on campaign_chat_messages for select
  using (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (thread_user_id = auth.uid() or app.is_world_admin(app.campaign_world_id(campaign_id)))
  );

drop policy campaign_chat_messages_insert on campaign_chat_messages;
create policy campaign_chat_messages_insert on campaign_chat_messages for insert
  with check (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and sender_id = auth.uid()
    and (thread_user_id = auth.uid() or app.is_world_admin(app.campaign_world_id(campaign_id)))
  );

-- Lecture par fil : la cle (campagne, lecteur) de la migration precedente
-- devient (campagne, lecteur, fil) — un joueur n'a qu'un fil (le sien), le
-- MJ une ligne par joueur dont il a ouvert le fil.
alter table campaign_chat_reads drop constraint campaign_chat_reads_pkey;
alter table campaign_chat_reads add column thread_user_id uuid references auth.users(id);
update campaign_chat_reads set thread_user_id = user_id where thread_user_id is null;
alter table campaign_chat_reads alter column thread_user_id set not null;
alter table campaign_chat_reads add primary key (campaign_id, user_id, thread_user_id);
