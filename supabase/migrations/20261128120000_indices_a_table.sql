-- V3.2-87 (ADR 0118, ADR 0122) — Les indices découverts dans le jeu à table.
--
-- En solo, la personne qui joue est propriétaire du monde : le serveur lit la
-- fiche allégée (`statblock`) et l'équipement (`inventory`) d'un PNJ et ne lui
-- envoie que les facettes découvertes. À une table, une joueuse ne lit pas ces
-- blocs (visibilité MJ, RLS) : le serveur, qui agit en son nom, ne peut donc
-- pas construire sa vue.
--
-- Cette fonction la construit EN BASE, et ne rend que ce qui est découvert :
-- elle est appelable par tout compte connecté (PostgREST l'expose), donc elle
-- ne doit jamais rendre un bloc entier. Elle reproduit `playerViewOfStatblock`
-- et `playerViewOfInventory` (src/core/rules/facets.ts) ; un test du noyau
-- et le test d'intégration V3.2-87 les gardent d'accord.
--
-- Droit : un membre de la partie (ou le MJ du monde), pour un PNJ du monde de
-- la partie. Facettes : celles de toute la table et celles de l'appelant,
-- jamais celles qu'une autre personne a découvertes seule (même règle que la
-- RLS de `entity_facet_discoveries`). Sinon : null.

create function public.npc_player_view(p_campaign uuid, p_entity uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  v_known text[];
  v_sheet jsonb;
  v_gear  jsonb;
  v_sheet_view jsonb := null;
  v_gear_view  jsonb := null;
  v_abilities  jsonb := '{}'::jsonb;
  v_key text;
begin
  if auth.uid() is null then return null; end if;
  if app.campaign_role(p_campaign) is null and not app.is_world_admin(app.campaign_world_id(p_campaign)) then return null; end if;
  if app.entity_world_id(p_entity) is distinct from app.campaign_world_id(p_campaign) then return null; end if;

  select coalesce(array_agg(facet), '{}') into v_known
    from entity_facet_discoveries
   where campaign_id = p_campaign and entity_id = p_entity
     and (user_id is null or user_id = auth.uid());

  select data into v_sheet from blocks where entity_id = p_entity and block_type = 'statblock' order by display_order, created_at limit 1;
  select data into v_gear  from blocks where entity_id = p_entity and block_type = 'inventory' order by display_order, created_at limit 1;

  if v_sheet is not null then
    foreach v_key in array array['str', 'dex', 'con', 'int', 'wis', 'cha'] loop
      if ('ability:' || v_key) = any (v_known) and v_sheet->'abilities' ? v_key then
        v_abilities := v_abilities || jsonb_build_object(v_key, v_sheet->'abilities'->v_key);
      end if;
    end loop;
    v_sheet_view := jsonb_build_object(
      'abilities', v_abilities,
      'actions', coalesce((
        select jsonb_agg(jsonb_build_object('name', a.value->'name', 'text', a.value->'text') order by a.ord)
          from jsonb_array_elements(coalesce(v_sheet->'actions', '[]'::jsonb)) with ordinality as a(value, ord)
         where ('action:' || (a.ord - 1)) = any (v_known)
      ), '[]'::jsonb),
      'traits', coalesce((
        select jsonb_agg(jsonb_build_object('name', t.value->'name', 'text', t.value->'text') order by t.ord)
          from jsonb_array_elements(coalesce(v_sheet->'traits', '[]'::jsonb)) with ordinality as t(value, ord)
         where ('trait:' || (t.ord - 1)) = any (v_known)
      ), '[]'::jsonb)
    );
    if 'ac' = any (v_known) then v_sheet_view := v_sheet_view || jsonb_build_object('ac', v_sheet->'ac'->'value'); end if;
    if 'hp' = any (v_known) then v_sheet_view := v_sheet_view || jsonb_build_object('hp', v_sheet->'hp'->'value'); end if;
    if 'speed' = any (v_known) then v_sheet_view := v_sheet_view || jsonb_build_object('speed', v_sheet->'speed'); end if;
  end if;

  if v_gear is not null then
    v_gear_view := jsonb_build_object('items', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', i.value->'id', 'qty', i.value->'qty', 'equipped', coalesce((i.value->>'equipped')::boolean, false))
               || case when i.value ? 'ref' then jsonb_build_object('ref', i.value->'ref') else jsonb_build_object('label', i.value->'label') end
               order by i.ord)
        from jsonb_array_elements(coalesce(v_gear->'items', '[]'::jsonb)) with ordinality as i(value, ord)
       where ('item:' || (i.value->>'id')) = any (v_known)
    ), '[]'::jsonb));
    if 'purse' = any (v_known) and v_gear ? 'currency' then
      v_gear_view := v_gear_view || jsonb_build_object('currency', v_gear->'currency');
    end if;
  end if;

  return jsonb_build_object('sheet', v_sheet_view, 'gear', v_gear_view);
end;
$$;

revoke execute on function public.npc_player_view(uuid, uuid) from public;
grant execute on function public.npc_player_view(uuid, uuid) to authenticated;

comment on function public.npc_player_view(uuid, uuid) is
  'V3.2-87 : la vue joueur d''un PNJ (facettes découvertes seulement), pour un membre de la partie. Reproduit playerViewOfStatblock / playerViewOfInventory.';
