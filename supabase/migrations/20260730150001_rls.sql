-- Migration 012 — Row Level Security (SCHEMA.md §19).
--
-- Perimetre Phase 0, assume : la RLS filtre par appartenance au monde. Elle
-- ne distingue pas encore MJ et joueur au sein d'une campagne, ni la
-- visibilite fine des blocs (ca, c'est la couche service en Phase 1, puis
-- descendu en RLS en Phase 2 — cf. SCHEMA.md §19.2). Ne pas ouvrir
-- l'application a des joueurs tiers avant la fin de la Phase 2.

-- =====================================================================
-- 1. Fonctions security definer — parade a la recursion RLS (SCHEMA.md
--    §19.1). Chacune a un search_path fige et son execute revoque pour
--    public, accorde seulement a authenticated : un client anonyme ne doit
--    meme pas pouvoir invoquer la fonction, encore moins lire une table.
-- =====================================================================

create or replace function app.is_world_member(p_world uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from worlds w where w.id = p_world and w.owner_id = auth.uid())
      or exists (select 1 from world_members m where m.world_id = p_world and m.user_id = auth.uid());
$$;

-- Necessaire pour le detail MJ/joueur en Phase 1+ ; pas encore utilisee par
-- une politique ici, mais c'est la fonction qui evitera la recursion sur
-- campaign_members quand ce role sera lu par une politique.
create or replace function app.campaign_role(p_campaign uuid)
returns text
language sql stable security definer set search_path = public, app as $$
  select role from campaign_members where campaign_id = p_campaign and user_id = auth.uid();
$$;

create or replace function app.campaign_world_id(p_campaign uuid)
returns uuid
language sql stable security definer set search_path = public, app as $$
  select world_id from campaigns where id = p_campaign;
$$;

create or replace function app.entity_world_id(p_entity uuid)
returns uuid
language sql stable security definer set search_path = public, app as $$
  select world_id from entities where id = p_entity;
$$;

create or replace function app.session_world_id(p_session uuid)
returns uuid
language sql stable security definer set search_path = public, app as $$
  select app.campaign_world_id(campaign_id) from sessions where id = p_session;
$$;

-- Un ruleset officiel est lisible par tout utilisateur authentifie ; un
-- ruleset personnalise par son createur, ou par qui appartient a un monde
-- ou une campagne qui l'utilise.
create or replace function app.can_read_ruleset(p_ruleset uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from rulesets r
    where r.id = p_ruleset
      and (
        r.is_official_base
        or r.created_by = auth.uid()
        or exists (select 1 from campaigns c where c.ruleset_id = r.id and app.is_world_member(c.world_id))
        or exists (select 1 from worlds w where w.default_ruleset_id = r.id and app.is_world_member(w.id))
      )
  );
$$;

create or replace function app.owns_ruleset(p_ruleset uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from rulesets r where r.id = p_ruleset and r.created_by = auth.uid());
$$;

create or replace function app.entry_ruleset_id(p_entry uuid)
returns uuid
language sql stable security definer set search_path = public, app as $$
  select ruleset_id from ruleset_entries where id = p_entry;
$$;

revoke execute on function app.is_world_member(uuid)   from public;
revoke execute on function app.campaign_role(uuid)      from public;
revoke execute on function app.campaign_world_id(uuid)  from public;
revoke execute on function app.entity_world_id(uuid)    from public;
revoke execute on function app.session_world_id(uuid)   from public;
revoke execute on function app.can_read_ruleset(uuid)   from public;
revoke execute on function app.owns_ruleset(uuid)       from public;
revoke execute on function app.entry_ruleset_id(uuid)   from public;

grant execute on function app.is_world_member(uuid)   to authenticated;
grant execute on function app.campaign_role(uuid)      to authenticated;
grant execute on function app.campaign_world_id(uuid)  to authenticated;
grant execute on function app.entity_world_id(uuid)    to authenticated;
grant execute on function app.session_world_id(uuid)   to authenticated;
grant execute on function app.can_read_ruleset(uuid)   to authenticated;
grant execute on function app.owns_ruleset(uuid)       to authenticated;
grant execute on function app.entry_ruleset_id(uuid)   to authenticated;

-- =====================================================================
-- 2. Activation — sans exception, refus par defaut (CLAUDE.md, regle 2).
-- =====================================================================

alter table profiles                    enable row level security;
alter table worlds                      enable row level security;
alter table world_members               enable row level security;
alter table entities                    enable row level security;
alter table blocks                      enable row level security;
alter table relations                   enable row level security;
alter table entity_mentions             enable row level security;
alter table entity_templates            enable row level security;
alter table entity_assets               enable row level security;
alter table entity_mechanical_revisions enable row level security;
alter table entity_revisions            enable row level security;
alter table rulesets                    enable row level security;
alter table ruleset_entries             enable row level security;
alter table ruleset_entry_blocks        enable row level security;
alter table ruleset_entry_translations  enable row level security;
alter table ruleset_entry_refs          enable row level security;
alter table ruleset_overrides           enable row level security;
alter table campaigns                   enable row level security;
alter table campaign_members            enable row level security;
alter table campaign_characters         enable row level security;
alter table campaign_entity_snapshots   enable row level security;
alter table sessions                    enable row level security;
alter table session_events              enable row level security;
alter table entity_runtime_state        enable row level security;
alter table entity_active_effects       enable row level security;
alter table entity_discoveries          enable row level security;
alter table dice_rolls                  enable row level security;
alter table ai_proposals                enable row level security;
alter table ai_usage_log                enable row level security;
alter table chunks                      enable row level security;
alter table embedding_queue             enable row level security;
alter table assets                      enable row level security;
alter table share_links                 enable row level security;

-- =====================================================================
-- 3. Politiques — comptes et mondes
-- =====================================================================

create policy profiles_select on profiles for select using (id = auth.uid());
create policy profiles_write  on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy worlds_select on worlds for select using (app.is_world_member(id));
create policy worlds_write  on worlds for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy world_members_select on world_members for select using (app.is_world_member(world_id));
create policy world_members_write  on world_members for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

-- =====================================================================
-- 4. Politiques — entites, blocs, relations, mentions, modeles
-- =====================================================================

create policy entities_select on entities for select
  using (deleted_at is null and app.is_world_member(world_id));
create policy entities_write on entities for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

create policy blocks_select on blocks for select
  using (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)));
create policy blocks_write on blocks for all
  using (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)))
  with check (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)));

create policy relations_select on relations for select using (app.is_world_member(world_id));
create policy relations_write  on relations for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

create policy entity_mentions_select on entity_mentions for select using (app.is_world_member(world_id));
create policy entity_mentions_write  on entity_mentions for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

-- world_id nul = modele fourni (builtin), visible par tout utilisateur
-- authentifie ; jamais par un client anonyme.
create policy entity_templates_select on entity_templates for select
  using ((world_id is null and auth.uid() is not null) or app.is_world_member(world_id));
create policy entity_templates_write on entity_templates for all
  using (world_id is not null and app.is_world_member(world_id))
  with check (world_id is not null and app.is_world_member(world_id));

create policy entity_assets_select on entity_assets for select
  using (app.is_world_member(app.entity_world_id(entity_id)));
create policy entity_assets_write on entity_assets for all
  using (app.is_world_member(app.entity_world_id(entity_id)))
  with check (app.is_world_member(app.entity_world_id(entity_id)));

create policy entity_mechanical_revisions_select on entity_mechanical_revisions for select
  using (app.is_world_member(app.entity_world_id(entity_id)));
create policy entity_mechanical_revisions_write on entity_mechanical_revisions for all
  using (app.is_world_member(app.entity_world_id(entity_id)))
  with check (app.is_world_member(app.entity_world_id(entity_id)));

create policy entity_revisions_select on entity_revisions for select
  using (app.is_world_member(app.entity_world_id(entity_id)));
create policy entity_revisions_write on entity_revisions for all
  using (app.is_world_member(app.entity_world_id(entity_id)))
  with check (app.is_world_member(app.entity_world_id(entity_id)));

-- =====================================================================
-- 5. Politiques — regles (rulesets et leurs enfants)
-- =====================================================================

create policy rulesets_select on rulesets for select
  using (
    is_official_base
    or created_by = auth.uid()
    or exists (select 1 from campaigns c where c.ruleset_id = rulesets.id and app.is_world_member(c.world_id))
    or exists (select 1 from worlds w where w.default_ruleset_id = rulesets.id and app.is_world_member(w.id))
  );
create policy rulesets_write on rulesets for all
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy ruleset_entries_select on ruleset_entries for select using (app.can_read_ruleset(ruleset_id));
create policy ruleset_entries_write  on ruleset_entries for all
  using (app.owns_ruleset(ruleset_id)) with check (app.owns_ruleset(ruleset_id));

create policy entry_blocks_select on ruleset_entry_blocks for select
  using (app.can_read_ruleset(app.entry_ruleset_id(entry_id)));
create policy entry_blocks_write on ruleset_entry_blocks for all
  using (app.owns_ruleset(app.entry_ruleset_id(entry_id)))
  with check (app.owns_ruleset(app.entry_ruleset_id(entry_id)));

create policy entry_translations_select on ruleset_entry_translations for select
  using (app.can_read_ruleset(app.entry_ruleset_id(entry_id)));
create policy entry_translations_write on ruleset_entry_translations for all
  using (app.owns_ruleset(app.entry_ruleset_id(entry_id)))
  with check (app.owns_ruleset(app.entry_ruleset_id(entry_id)));

create policy entry_refs_select on ruleset_entry_refs for select
  using (app.can_read_ruleset(app.entry_ruleset_id(source_entry_id)));
create policy entry_refs_write on ruleset_entry_refs for all
  using (app.owns_ruleset(app.entry_ruleset_id(source_entry_id)))
  with check (app.owns_ruleset(app.entry_ruleset_id(source_entry_id)));

create policy overrides_select on ruleset_overrides for select using (app.can_read_ruleset(ruleset_id));
create policy overrides_write  on ruleset_overrides for all
  using (app.owns_ruleset(ruleset_id)) with check (app.owns_ruleset(ruleset_id));

-- =====================================================================
-- 6. Politiques — campagnes et parties
-- =====================================================================

create policy campaigns_select on campaigns for select using (app.is_world_member(world_id));
create policy campaigns_write  on campaigns for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

-- Anti-recursion : on interroge campaigns (via campaign_world_id), jamais
-- campaign_members depuis sa propre politique (SCHEMA.md §19.1).
create policy campaign_members_select on campaign_members for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy campaign_members_write on campaign_members for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy campaign_characters_select on campaign_characters for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy campaign_characters_write on campaign_characters for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy campaign_entity_snapshots_select on campaign_entity_snapshots for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy campaign_entity_snapshots_write on campaign_entity_snapshots for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

-- =====================================================================
-- 7. Politiques — sessions, journal, etat de jeu, decouvertes, des
-- =====================================================================

create policy sessions_select on sessions for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy sessions_write on sessions for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy session_events_select on session_events for select
  using (app.is_world_member(app.session_world_id(session_id)));
create policy session_events_write on session_events for all
  using (app.is_world_member(app.session_world_id(session_id)))
  with check (app.is_world_member(app.session_world_id(session_id)));

create policy entity_runtime_state_select on entity_runtime_state for select
  using (app.is_world_member(app.entity_world_id(entity_id)));
create policy entity_runtime_state_write on entity_runtime_state for all
  using (app.is_world_member(app.entity_world_id(entity_id)))
  with check (app.is_world_member(app.entity_world_id(entity_id)));

create policy entity_active_effects_select on entity_active_effects for select
  using (app.is_world_member(app.entity_world_id(entity_id)));
create policy entity_active_effects_write on entity_active_effects for all
  using (app.is_world_member(app.entity_world_id(entity_id)))
  with check (app.is_world_member(app.entity_world_id(entity_id)));

create policy entity_discoveries_select on entity_discoveries for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy entity_discoveries_write on entity_discoveries for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy dice_rolls_select on dice_rolls for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy dice_rolls_write on dice_rolls for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

-- =====================================================================
-- 8. Politiques — IA, RAG, fichiers
-- =====================================================================

create policy ai_proposals_select on ai_proposals for select using (app.is_world_member(world_id));
create policy ai_proposals_write  on ai_proposals for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

-- Journal personnel de couts, pas rattache a un monde : chacun ne voit que
-- ses propres lignes (SCHEMA.md §16.3).
create policy ai_usage_log_select on ai_usage_log for select using (user_id = auth.uid());
create policy ai_usage_log_write  on ai_usage_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chunks_select on chunks for select using (app.is_world_member(world_id));
create policy chunks_write  on chunks for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

create policy embedding_queue_select on embedding_queue for select
  using (exists (select 1 from chunks c where c.id = embedding_queue.chunk_id and app.is_world_member(c.world_id)));
create policy embedding_queue_write on embedding_queue for all
  using (exists (select 1 from chunks c where c.id = embedding_queue.chunk_id and app.is_world_member(c.world_id)))
  with check (exists (select 1 from chunks c where c.id = embedding_queue.chunk_id and app.is_world_member(c.world_id)));

create policy assets_select on assets for select using (app.is_world_member(world_id));
create policy assets_write  on assets for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

create policy share_links_select on share_links for select using (app.is_world_member(world_id));
create policy share_links_write  on share_links for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));
