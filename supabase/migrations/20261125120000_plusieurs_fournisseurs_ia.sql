-- ADR 0108 — plusieurs fournisseurs d'IA par compte, plusieurs modèles par
-- fournisseur, un seul couple (fournisseur, modèle) qui sert à la fois.
--
-- Jusqu'ici (ADR 0103, migration 20261118120000), une ligne par compte et un
-- seul modèle. Désormais :
--   * `ai_providers` reçoit sa propre clé `id` ; `user_id` n'est plus unique ;
--   * `model` devient `models`, une liste de 1 à 12 identifiants (une seule clé
--     OpenRouter donne accès à tous ses modèles : on ne la tape qu'une fois) ;
--   * `ai_provider_choices`, une ligne par compte, dit lequel sert.
--
-- Les lignes existantes sont reprises telles quelles : leur modèle devient le
-- seul de la liste, et le choix pointe sur elles.

alter table ai_providers add column id uuid not null default gen_random_uuid();
alter table ai_providers add column models text[];
update ai_providers set models = array[model];
alter table ai_providers alter column models set not null;
alter table ai_providers add constraint ai_providers_models_check
  check (cardinality(models) between 1 and 12 and length(array_to_string(models, '')) <= 1500);

alter table ai_providers drop constraint ai_providers_pkey;
alter table ai_providers add primary key (id);
create index if not exists ai_providers_user_id_idx on ai_providers (user_id);
alter table ai_providers drop column model;

-- Les politiques de 20261118120000 (`user_id = auth.uid()` sur les quatre
-- opérations, réécrites en `(select auth.uid())` par 20261124160000) restent justes ligne à ligne : rien à changer.

create table if not exists ai_provider_choices (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  -- Le fournisseur supprimé emporte le choix : le serveur retombe alors sur
  -- la règle de repli (`choixEffectif`, src/core/ai/providerChoice.ts).
  provider_id uuid not null references ai_providers (id) on delete cascade,
  model       text not null check (length(btrim(model)) between 1 and 120),
  updated_at  timestamptz not null default now()
);

alter table ai_provider_choices enable row level security;

-- Chacun chez soi, et seulement vers SES fournisseurs : sans le `exists`, un
-- compte pourrait pointer son choix sur le fournisseur d'un autre (dont il
-- connaîtrait l'identifiant) et faire payer ses tours à sa clé.
create policy ai_provider_choices_select on ai_provider_choices for select
  using (user_id = (select auth.uid()));
create policy ai_provider_choices_insert on ai_provider_choices for insert
  with check (user_id = (select auth.uid()) and exists (select 1 from ai_providers p where p.id = provider_id and p.user_id = (select auth.uid())));
create policy ai_provider_choices_update on ai_provider_choices for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from ai_providers p where p.id = provider_id and p.user_id = (select auth.uid())));
create policy ai_provider_choices_delete on ai_provider_choices for delete
  using (user_id = (select auth.uid()));

insert into ai_provider_choices (user_id, provider_id, model)
select user_id, id, models[1] from ai_providers
on conflict (user_id) do nothing;

comment on table ai_provider_choices is
  'ADR 0108 : le couple (fournisseur, modèle) qui sert pour un compte. Choisi depuis la page Compte ou le solo.';
