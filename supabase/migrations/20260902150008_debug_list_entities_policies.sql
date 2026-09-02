-- Diagnostic TEMPORAIRE : liste les politiques REELLEMENT actives sur
-- `entities` en base, pour verifier qu'aucune politique orpheline
-- (jamais retiree malgre un DROP dans les fichiers de migration) ne
-- traine encore.
create or replace function public.debug_list_entities_policies()
returns table (policyname name, cmd text, permissive text, qual text, with_check text)
language sql stable security definer set search_path = public, pg_catalog as $$
  select polname, case polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' when '*' then 'all' end,
         case when polpermissive then 'permissive' else 'restrictive' end,
         pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
  from pg_policy
  where polrelid = 'public.entities'::regclass;
$$;

grant execute on function public.debug_list_entities_policies() to authenticated;
