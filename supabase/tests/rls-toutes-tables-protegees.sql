-- Controle de la regle absolue n° 3 de CLAUDE.md : "RLS activee sur TOUTES
-- les tables, refus par defaut" (audit B-04).
--
-- Pourquoi ce fichier existe. Cette regle n'etait verifiee que par
-- relecture : rien ne la contrôlait mecaniquement, alors que c'est la
-- garantie de securite la plus fondamentale du projet — la cle `anon` est
-- publique par construction, et tout ce que la RLS laisse passer est
-- lisible par n'importe qui.
--
-- Le risque n'est pas theorique. L'historique contient une migration qui
-- DESACTIVE la RLS sur `entities` (20260902150009, sonde de diagnostic),
-- reactivee par la suivante (20260902150010). Si une application de
-- migrations s'interrompt entre les deux — reseau coupe, `supabase db
-- push` interrompu — la base reste avec la RLS desactivee sur la table la
-- plus centrale, et RIEN ne le signale.
--
-- A executer apres tout deploiement de migrations (meme convention que
-- p0-06, pas de Docker local dans cet environnement) :
--   supabase db query --linked --file supabase/tests/rls-toutes-tables-protegees.sql
--
-- Lecture seule, aucun effet de bord, idempotent.

do $$
declare
  v_sans_rls      text := '';
  v_sans_policy   text := '';
  v_nb_tables     int;
  r               record;
begin
  -- 1. Toute table applicative doit avoir la RLS ACTIVEE.
  --    `relkind = 'r'` : les vues et les tables partitionnees sont exclues,
  --    elles n'ont pas de RLS propre.
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
    order by c.relname
  loop
    v_sans_rls := v_sans_rls || r.relname || ' ';
  end loop;

  -- 2. Une table avec la RLS activee mais AUCUNE politique refuse tout,
  --    pour tout le monde. C'est sur, mais c'est presque toujours un oubli
  --    (table creee, RLS activee, policies jamais ecrites) : l'application
  --    lira des resultats vides sans la moindre erreur, ce qui est le
  --    genre de panne qu'on cherche pendant des heures.
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    order by c.relname
  loop
    v_sans_policy := v_sans_policy || r.relname || ' ';
  end loop;

  select count(*) into v_nb_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  if v_sans_rls <> '' then
    raise exception 'RLS DESACTIVEE sur : %— regle absolue n° 3 enfreinte, ces tables sont lisibles avec la cle anon.', v_sans_rls;
  end if;

  if v_sans_policy <> '' then
    raise warning 'RLS activee mais AUCUNE politique sur : %— ces tables refusent tout, y compris a leur proprietaire. Oubli probable.', v_sans_policy;
  end if;

  raise notice 'OK : les % tables du schema public ont toutes la RLS activee.', v_nb_tables;
end $$;
