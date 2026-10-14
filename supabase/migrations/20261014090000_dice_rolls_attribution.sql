-- V3.1-89 (ADR 0064) — attribuer chaque jet, pour les statistiques du joueur.
--
-- 1. `dice_rolls.rolled_by_user_id` (la colonne décidée par l'ADR 0038, que
--    V3.1-22 réutilisera) : le compte qui a lancé. Posé par la BASE
--    (`default auth.uid()`) et contrôlé à l'insertion : personne n'écrit un
--    jet au nom d'un autre.
-- 2. `dice_rolls.entity_id` : le personnage du jet. Contrôlé à l'insertion :
--    une fiche du monde de la campagne, que l'auteur a le droit de modifier
--    (son PJ ; toute fiche pour le MJ). Sans cette garde, un joueur pourrait
--    attribuer des jets au personnage d'un autre et fausser ses statistiques.
-- Jets anciens : les deux colonnes restent nulles ; ils sont exclus des
-- statistiques personnelles (décision de l'auteur, 9 octobre).
alter table dice_rolls
  add column rolled_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  add column entity_id uuid references entities(id) on delete set null;

create index dice_rolls_campaign_entity_created_idx on dice_rolls (campaign_id, entity_id, created_at desc);

comment on column dice_rolls.rolled_by_user_id is 'Compte qui a lancé (ADR 0038, 0064) : posé par la base, jamais par le client.';
comment on column dice_rolls.entity_id is 'Personnage du jet (V3.1-89) : null pour un jet libre sans personnage réclamé, et pour les jets antérieurs.';

drop policy if exists dice_rolls_insert on dice_rolls;
create policy dice_rolls_insert on dice_rolls for insert
  with check (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (visibility_level = 'public' or app.is_world_admin(app.campaign_world_id(campaign_id)))
    and rolled_by_user_id is not distinct from auth.uid()
    and (
      entity_id is null
      or (app.entity_world_id(entity_id) = app.campaign_world_id(campaign_id) and app.can_edit_entity(entity_id))
    )
  );

-- 3. Les paliers des titres des joueurs : des RÉGLAGES de la plateforme
--    (le superadmin les change, V3.1-92), pas du contenu de règles. Lecture
--    pour tout compte connecté, écriture superadmin. La forme d'une ligne est
--    validée par Zod côté serveur (`zPlayerTitleTier`) ; la base garde les
--    contraintes structurelles.
create table player_title_tiers (
  id          uuid primary key default gen_random_uuid(),
  family      text not null check (family in ('luck', 'bad_luck', 'purse', 'favorite_action')),
  position    integer not null default 0,
  range_from  numeric,
  range_to    numeric,
  action_kind text check (action_kind in ('sneak_attack', 'attack', 'spell', 'heal', 'check')),
  name        text not null,
  template    text not null default '',
  icon_key    text not null,
  color_token text not null check (color_token in ('success', 'danger', 'accent', 'link_entity', 'link_rule')),
  updated_at  timestamptz not null default now(),
  check ((family = 'favorite_action') = (action_kind is not null)),
  check (family = 'favorite_action' or range_from is not null)
);

alter table player_title_tiers enable row level security;

create policy player_title_tiers_select on player_title_tiers for select
  using (auth.uid() is not null);
create policy player_title_tiers_write on player_title_tiers for all
  using (app.is_superadmin())
  with check (app.is_superadmin());

insert into player_title_tiers (family, position, range_from, range_to, action_kind, name, template, icon_key, color_token) values
  ('luck', 0, 0, 0.8, null, 'En attente d''un miracle', '{n20} × 20 naturels (table : {table20})', 'star', 'accent'),
  ('luck', 1, 0.8, 1.2, null, 'Bonne étoile', '{n20} × 20 naturels (table : {table20})', 'clover', 'link_entity'),
  ('luck', 2, 1.2, null, null, 'Béni des dés', '{n20} × 20 naturels — plus que toute la table', 'd20', 'success'),
  ('bad_luck', 0, 0, 0.8, null, 'Pied ferme', '{n1} × 1 naturels', 'shield', 'link_entity'),
  ('bad_luck', 1, 0.8, 1.2, null, 'Ça arrive', '{n1} × 1 naturels', 'd20', 'accent'),
  ('bad_luck', 2, 1.2, null, null, 'Chat noir', '{n1} × 1 naturels, dont {suite} d''affilée', 'cat', 'danger'),
  ('purse', 0, 0, 0.5, null, 'Écureuil', '−{depense} po dépensées pour +{gagne} gagnées', 'purse', 'success'),
  ('purse', 1, 0.5, 1, null, 'Bon gestionnaire', '−{depense} po dépensées pour +{gagne} gagnées', 'coin', 'accent'),
  ('purse', 2, 1, null, null, 'Bourse percée', '−{depense} po dépensées pour +{gagne} gagnées', 'purse', 'danger'),
  ('favorite_action', 0, null, null, 'sneak_attack', 'Lame de l''ombre', '{action}, ×{fois} ; record : {record} dégâts', 'dagger', 'link_rule'),
  ('favorite_action', 1, null, null, 'attack', 'Bretteur', '{action}, ×{fois} ; record : {record} dégâts', 'sword', 'accent'),
  ('favorite_action', 2, null, null, 'spell', 'Arcaniste', '{action}, ×{fois} ; record : {record} dégâts', 'wand', 'link_rule'),
  ('favorite_action', 3, null, null, 'heal', 'Main secourable', '{action}, ×{fois} ; record : {record} dégâts', 'heart', 'success'),
  ('favorite_action', 4, null, null, 'check', 'Prudent', '{action}, ×{fois} ; record : {record} dégâts', 'shield', 'link_entity');
