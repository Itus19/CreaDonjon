-- V3.1-103 (ADR 0040) — les jets d'initiative des joueurs.
--
-- 1. Un statut `rolling` (« jets d'initiative ») entre `draft` et `running` :
--    le MJ demande les jets, chaque joueuse écrit l'initiative de son PJ,
--    puis le MJ commence le combat.
alter table combats drop constraint if exists combats_status_check;
alter table combats
  add constraint combats_status_check check (status in ('draft', 'rolling', 'running', 'ended'));

-- 2. La seule écriture d'une joueuse dans `combat_participants` (fermée au
--    MJ depuis V3.1-101) : l'initiative du participant qui est SON PJ
--    (`campaign_characters.user_id`), seulement pendant les jets
--    (`rolling`), valeur −10 à 40. Le chemin « lancer » tire côté serveur
--    (règle 8) ; le chemin « vrai dé » reçoit le dé de la table. Appelée à la
--    main, la fonction ne permet rien de plus qu'annoncer un dé, ce que la
--    règle permet déjà (« annoncé à la main », V3-B5).
--    Renvoie la ligne avant et après (pour le journal du combat et son
--    annulation, même forme que les saisies du MJ), ou `null` si refusé.
create function public.set_own_initiative(p_participant uuid, p_value int)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_before combat_participants;
  v_after combat_participants;
  v_campaign uuid;
  v_status text;
begin
  if v_uid is null or p_value is null or p_value < -10 or p_value > 40 then
    return null;
  end if;

  select cp.* into v_before from combat_participants cp where cp.id = p_participant for update;
  if not found or v_before.entity_id is null then
    return null;
  end if;

  -- Verrou partagé : le MJ ne peut pas commencer le combat au milieu de l'écriture.
  select c.campaign_id, c.status into v_campaign, v_status
    from combats c where c.id = v_before.combat_id for share;
  if v_status is distinct from 'rolling' then
    return null;
  end if;

  if not exists (
    select 1 from campaign_characters cc
     where cc.campaign_id = v_campaign and cc.entity_id = v_before.entity_id and cc.user_id = v_uid and cc.is_pc
  ) then
    return null;
  end if;

  update combat_participants set initiative = p_value where id = p_participant returning * into v_after;
  return jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after));
end;
$$;

revoke execute on function public.set_own_initiative(uuid, int) from public, anon;
grant execute on function public.set_own_initiative(uuid, int) to authenticated;
