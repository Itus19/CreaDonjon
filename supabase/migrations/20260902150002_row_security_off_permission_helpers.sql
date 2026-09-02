-- Suite immediate de 20260902150001 (meme bug, jamais resolu par ce seul
-- correctif) : retirer le garde-fou redondant de `can_edit_entity` n'a pas
-- suffi, l'erreur persiste, identique. Cause reelle : `app.entity_world_id`
-- -- appelee PAR `can_edit_entity` -- fait elle-meme `select world_id from
-- entities where id = p_entity`, une requete qui retombe sous
-- `entities_select` (`deleted_at is null AND is_world_member(...)`) au
-- lieu d'ignorer la RLS comme une fonction `security definer` le devrait
-- en principe (le proprietaire d'une table contourne normalement sa
-- propre RLS -- mais visiblement pas suffisant ici, verifie en direct :
-- retirer le garde-fou de can_edit_entity seul n'a rien change). Au
-- moment ou `entities_update.with check` evalue la ligne PROPOSEE (deja
-- `deleted_at = now()`), cette sous-requete ne trouve plus rien, renvoie
-- `null`, et tout le reste de la chaine (`is_world_admin`, les
-- verifications de grants) devient faux par ricochet -- exactement le
-- meme mecanisme que 20260902150001, juste un cran plus loin dans la
-- chaine d'appel.
--
-- Corrige en desactivant explicitement la RLS a l'interieur de ces
-- fonctions d'autorisation (`set row_security = off`) -- le motif standard
-- Postgres pour une fonction `security definer` qui DOIT voir l'etat reel
-- d'une table pour rendre un verdict de securite correct, plutot que de
-- compter sur un contournement proprietaire implicite qui ne s'est pas
-- avere fiable ici. Sans danger : ces fonctions ne RENVOIENT jamais les
-- lignes lues, seulement un booleen/uuid derive -- aucune fuite de donnee,
-- juste une decision d'autorisation qui doit porter sur l'etat REEL de la
-- ligne, deleted_at y compris.
create or replace function app.entity_world_id(p_entity uuid)
returns uuid
language sql stable security definer set search_path = public, app set row_security = off as $$
  select world_id from entities where id = p_entity;
$$;

create or replace function app.is_world_admin(p_world_id uuid)
returns boolean
language sql stable security definer set search_path = public, app set row_security = off as $$
  select
    exists (select 1 from worlds w where w.id = p_world_id and w.owner_id = auth.uid())
    or exists (select 1 from world_members m where m.world_id = p_world_id and m.user_id = auth.uid() and m.role in ('owner', 'editor'))
    or exists (
         select 1 from campaign_members cm
         join campaigns c on c.id = cm.campaign_id
         where c.world_id = p_world_id and cm.user_id = auth.uid() and cm.role = 'gm'
       );
$$;

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
    or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid());
$$;
