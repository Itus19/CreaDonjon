-- Corrige `app.import_upsert_ruleset` (migration 20260730180001), restee
-- aveugle a une colonne ajoutee un mois apres elle.
--
-- Constat : la migration 20260817130001 (V1-D5) ajoute
-- `rulesets.content_origin not null default 'user_created'` PUIS la
-- contrainte `rulesets_official_origin_consistent`, qui exige que
-- `is_official_base` et `content_origin` s'accordent toujours. Son backfill
-- a bien recale les lignes DEJA presentes, mais la fonction d'import, elle,
-- n'a jamais ete touchee : elle insere encore un ruleset officiel sans
-- renseigner `content_origin`, qui retombe donc sur 'user_created' et viole
-- la contrainte.
--
-- Pourquoi ca n'a jamais explose : sur les bases existantes, le SRD avait
-- ete importe AVANT le 17 aout, donc `import_upsert_ruleset` retournait
-- l'identifiant deja en place sans jamais atteindre l'INSERT. Le defaut ne
-- se revele que sur une base NEUVE — c'est-a-dire exactement le chemin
-- d'amorcage documente (`supabase db reset` puis `npm run ingest:srd`), qui
-- est casse depuis un mois sans que personne l'ait rejoue.
--
-- Trouve en montant une instance locale pour la mesure S2 (V3), pas en
-- relisant le code.
--
-- Le reste de la fonction est reproduit a l'identique : seule la colonne
-- manquante est ajoutee a l'INSERT.
create or replace function app.import_upsert_ruleset(p_base_system text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_id uuid;
begin
  select id into v_id from rulesets where is_official_base and base_system = p_base_system limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into rulesets (name, base_system, is_official_base, content_origin, created_by)
  values (p_name, p_base_system, true, 'official_srd', null)
  returning id into v_id;

  return v_id;
end;
$$;

-- Les droits ne sont pas rejoues : `create or replace` conserve ceux poses
-- par la migration 20260730180001 (revoke public, grant service_role).
