-- V1-D5 : rulesets de reference personnelle (specs/ruleset-personnel.md).
-- Colonne content_origin + garde-fous en base (triggers, jamais de simples
-- avertissements d'interface) : partage refuse, bascule hors de
-- personal_reference interdite (§3.1, §3.3). Ce contenu n'est jamais saisi
-- par l'agent de codage ni place dans ce depot (CLAUDE.md, Rappel
-- juridique) — cette migration n'ajoute que le mecanisme et ses verrous,
-- aucune donnee.

alter table rulesets
  add column content_origin text not null default 'user_created'
  check (content_origin in ('official_srd', 'user_created', 'personal_reference'));

-- app.forbid_official_ruleset_write (migration 004) verrouille toute
-- ecriture sur un ruleset officiel, y compris ce backfill : contrairement
-- aux deux verrous soeurs sur ruleset_entries/ruleset_entry_blocks, elle ne
-- connaissait pas encore l'echappatoire app.allow_official_writes (reservee
-- a l'import SRD). Alignee ici sur le meme motif, pour ce backfill unique.
create or replace function app.forbid_official_ruleset_write()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_official_writes', true), 'off') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if (tg_op = 'DELETE') then
    if old.is_official_base then raise exception 'Ruleset officiel non modifiable'; end if;
    return old;
  end if;
  if old.is_official_base and new.is_official_base then
    raise exception 'Ruleset officiel non modifiable';
  end if;
  return new;
end;
$$;

-- Coherence avec is_official_base : les deux colonnes doivent toujours
-- s'accorder, jamais l'une sans l'autre.
select set_config('app.allow_official_writes', 'on', true);
update rulesets set content_origin = 'official_srd' where is_official_base;

alter table rulesets
  add constraint rulesets_official_origin_consistent check (
    (is_official_base and content_origin = 'official_srd')
    or (not is_official_base and content_origin <> 'official_srd')
  );

-- Aucune bascule hors de personal_reference (§3.3 : "jamais de conversion
-- personal_reference -> user_created, la bascule est interdite, pas
-- deconseillee"). Ne lit que OLD/NEW, meme motif que
-- app.forbid_official_ruleset_write : pas de jointure, pas besoin de
-- security definer ici.
create or replace function app.forbid_personal_reference_downgrade()
returns trigger language plpgsql as $$
begin
  if old.content_origin = 'personal_reference' and new.content_origin <> 'personal_reference' then
    raise exception 'Un ruleset de reference personnelle ne peut jamais changer d''origine';
  end if;
  return new;
end;
$$;

create trigger rulesets_forbid_personal_reference_downgrade
  before update on rulesets
  for each row execute function app.forbid_personal_reference_downgrade();

-- Refus d'un lien de partage sur un monde ou une campagne fondes sur un
-- ruleset de reference personnelle (§3.1 : "lien de partage public ou
-- anonyme -> refuse, sortie du cercle prive"). Verifie le ruleset par
-- defaut du monde ET, si le lien cible une campagne precise, le ruleset
-- que cette campagne epingle (campaigns.ruleset_id peut differer du
-- ruleset par defaut du monde, V1-C1 : une campagne choisit son propre
-- ruleset a la creation). security definer, meme motif que
-- app.is_world_member/app.can_read_ruleset (migration RLS) : la
-- verification doit voir l'etat reel de rulesets/campaigns quelle que
-- soit la visibilite RLS de l'appelant sur ces lignes — un simple
-- security invoker pourrait silencieusement ne rien trouver et laisser
-- passer le partage si l'appelant n'a pas lui-meme le droit de lire la
-- ligne ruleset concernee.
create or replace function app.forbid_share_personal_ruleset()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  world_origin text;
  campaign_origin text;
begin
  select r.content_origin into world_origin
    from worlds w join rulesets r on r.id = w.default_ruleset_id
   where w.id = new.world_id;

  if world_origin = 'personal_reference' then
    raise exception 'Un monde utilisant un ruleset de reference personnelle ne peut pas etre partage';
  end if;

  if new.campaign_id is not null then
    select r.content_origin into campaign_origin
      from campaigns c join rulesets r on r.id = c.ruleset_id
     where c.id = new.campaign_id;

    if campaign_origin = 'personal_reference' then
      raise exception 'Une campagne fondee sur un ruleset de reference personnelle ne peut pas etre partagee';
    end if;
  end if;

  return new;
end;
$$;

create trigger share_links_forbid_personal_reference
  before insert on share_links
  for each row execute function app.forbid_share_personal_ruleset();
