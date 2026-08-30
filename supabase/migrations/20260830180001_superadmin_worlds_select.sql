-- V2-M6 (Lot M) — le journal fusionne et le generateur de liens de la
-- section Administration doivent pouvoir choisir N'IMPORTE QUEL monde
-- (pas seulement ceux du superadmin) : `worlds_select` restait borne a
-- `app.is_world_member`, oublie dans la premiere passe (migration
-- 20260830170001).
drop policy worlds_select on worlds;
create policy worlds_select on worlds for select
  using (app.is_superadmin() or app.is_world_member(id));
