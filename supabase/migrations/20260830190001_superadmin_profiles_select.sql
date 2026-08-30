-- V2-M6 (Lot M) — le journal fusionne doit afficher le nom de CHAQUE
-- compte qui a modifie quelque chose, pas seulement celui du superadmin
-- lui-meme : `profiles_select` restait borne a `id = auth.uid()`.
drop policy profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or app.is_superadmin());
