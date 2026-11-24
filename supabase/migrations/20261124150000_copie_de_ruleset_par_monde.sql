-- AG-18 (ADR 0106) : un ruleset personnel choisi à la création d'un monde
-- devient une copie propre à ce monde, qui retient sa source. Quand la source
-- change, le monde montre « mise à jour disponible » et la personne choisit,
-- règle par règle, de reprendre la nouvelle version ou de garder la sienne.
--
-- Une variante ne stocke que ses surcharges (SCHEMA.md §9.4) : copier une
-- variante, c'est copier ses lignes de `ruleset_overrides` sous un nouveau
-- ruleset, de même parent. La chaîne au-dessus (la base officielle, ou une
-- variante parente) reste partagée.

alter table rulesets
  add column copied_from_ruleset_id uuid references rulesets(id) on delete set null,
  -- `entry_key` -> empreinte des surcharges de la source au moment de la
  -- copie ou du dernier choix (ADR 0106). Pas une valeur dérivée de la copie
  -- (règle 16) : un repère daté, qu'aucun calcul ne peut retrouver plus tard.
  add column copy_baseline jsonb;

comment on column rulesets.copied_from_ruleset_id is 'AG-18 : le ruleset dont celui-ci est la copie propre à un monde ; null sinon, ou si la source a été supprimée.';

-- Empreinte de chaque règle d'un ruleset : un md5 de toutes ses surcharges
-- (type de bloc, action, contenu), dans un ordre fixe. Le texte d'un jsonb
-- est normalisé (clés triées), donc deux contenus égaux donnent la même
-- empreinte. `label` : le nom posé par la surcharge qui crée ou remplace
-- l'entrée, sinon la clé. Security invoker : la RLS de `ruleset_overrides`
-- s'applique, on ne lit que ce qu'on peut déjà lire.
create or replace function public.ruleset_override_digests(p_ruleset_id uuid)
returns table (entry_key text, digest text, label text)
language sql stable security invoker set search_path = public as $$
  select o.entry_key,
         md5(jsonb_agg(jsonb_build_object('b', coalesce(o.block_type, ''), 'a', o.action, 'p', o.payload, 'm', o.patch)
                       order by coalesce(o.block_type, ''), o.action)::text),
         coalesce(max(o.payload ->> 'name') filter (where o.action in ('add_entry', 'replace_entry')), o.entry_key)
  from ruleset_overrides o
  where o.ruleset_id = p_ruleset_id
  group by o.entry_key;
$$;

revoke all on function public.ruleset_override_digests(uuid) from public;
grant execute on function public.ruleset_override_digests(uuid) to authenticated;

-- Copie un ruleset de l'appelant pour un monde, d'un seul tenant : le ruleset,
-- ses surcharges, la référence. Refuse une base officielle (rien à copier, on
-- la partage) et le ruleset d'un autre compte. Security invoker : la RLS
-- (`rulesets_write`, `overrides_write`) exige déjà `created_by = auth.uid()`.
create or replace function public.copy_ruleset_for_world(p_source_id uuid, p_name text)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_source rulesets%rowtype;
  v_id uuid;
begin
  select * into v_source from rulesets where id = p_source_id;
  if not found or v_source.is_official_base or v_source.created_by is distinct from auth.uid() then
    raise exception 'Ruleset introuvable ou non copiable' using errcode = 'P0002';
  end if;

  insert into rulesets (name, base_system, parent_ruleset_id, content_origin, created_by, copied_from_ruleset_id, copy_baseline)
  values (
    left(p_name, 200), v_source.base_system, v_source.parent_ruleset_id, v_source.content_origin, auth.uid(), v_source.id,
    coalesce((select jsonb_object_agg(d.entry_key, d.digest) from public.ruleset_override_digests(v_source.id) d), '{}'::jsonb)
  )
  returning id into v_id;

  insert into ruleset_overrides (ruleset_id, entry_key, block_type, action, payload, patch, note, created_by)
  select v_id, o.entry_key, o.block_type, o.action, o.payload, o.patch, o.note, auth.uid()
  from ruleset_overrides o
  where o.ruleset_id = v_source.id;

  return v_id;
end;
$$;

revoke all on function public.copy_ruleset_for_world(uuid, text) from public;
grant execute on function public.copy_ruleset_for_world(uuid, text) to authenticated;

-- Un choix sur une règle d'une copie. `p_take` : reprendre la version de la
-- source (les surcharges de cette clé dans la copie sont remplacées par
-- celles de la source, ou retirées si la source l'a retirée) ; sinon garder
-- la sienne. Dans les deux cas la référence prend l'empreinte actuelle de la
-- source, et la règle quitte la liste. `p_expected_digest` : l'empreinte que
-- l'écran a montrée ; si la source a encore changé depuis, rien n'est fait
-- (`false`) et l'écran se recharge plutôt que d'appliquer une version que
-- personne n'a vue.
create or replace function public.sync_ruleset_copy_entry(p_copy_id uuid, p_entry_key text, p_take boolean, p_expected_digest text)
returns boolean
language plpgsql security invoker set search_path = public as $$
declare
  v_copy rulesets%rowtype;
  v_digest text;
begin
  select * into v_copy from rulesets where id = p_copy_id for update;
  if not found or v_copy.created_by is distinct from auth.uid() or v_copy.copied_from_ruleset_id is null or v_copy.published_at is not null then
    raise exception 'Copie introuvable' using errcode = 'P0002';
  end if;

  select d.digest into v_digest from public.ruleset_override_digests(v_copy.copied_from_ruleset_id) d where d.entry_key = p_entry_key;
  if v_digest is distinct from p_expected_digest then
    return false;
  end if;

  if p_take then
    delete from ruleset_overrides where ruleset_id = p_copy_id and entry_key = p_entry_key;
    insert into ruleset_overrides (ruleset_id, entry_key, block_type, action, payload, patch, note, created_by)
    select p_copy_id, o.entry_key, o.block_type, o.action, o.payload, o.patch, o.note, auth.uid()
    from ruleset_overrides o
    where o.ruleset_id = v_copy.copied_from_ruleset_id and o.entry_key = p_entry_key;
  end if;

  update rulesets
     set copy_baseline = case when v_digest is null then coalesce(copy_baseline, '{}'::jsonb) - p_entry_key
                              else jsonb_set(coalesce(copy_baseline, '{}'::jsonb), array[p_entry_key], to_jsonb(v_digest)) end
   where id = p_copy_id;
  return true;
end;
$$;

revoke all on function public.sync_ruleset_copy_entry(uuid, text, boolean, text) from public;
grant execute on function public.sync_ruleset_copy_entry(uuid, text, boolean, text) to authenticated;
