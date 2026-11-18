-- V3.1-224 (ADR 0103) — le fournisseur d'IA de chaque compte.
--
-- Jusqu'ici, un seul fournisseur pour toute l'application, dans les variables
-- d'environnement du serveur. Désormais chaque compte déclare le sien : sa clé
-- chez un fournisseur distant, ou l'adresse de sa propre machine. Personne ne
-- consomme les ressources d'un autre.
--
-- `secret` est la clé d'API **déjà chiffrée par l'application** (AES-256-GCM,
-- `src/server/ai/secrets.ts`) : la base ne voit jamais la valeur en clair, pas
-- même le temps d'une requête. Elle ne sort jamais vers un client — l'écran
-- n'affiche que « clé posée le … ».

create table if not exists ai_providers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  label      text not null check (length(btrim(label)) between 1 and 60),
  base_url   text not null check (length(base_url) between 8 and 300),
  model      text not null check (length(btrim(model)) between 1 and 120),
  -- `null` : fournisseur sans clé (une IA locale, typiquement).
  secret     text check (secret is null or length(secret) between 16 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_providers enable row level security;

-- Refus par défaut, et chacun chez soi : aucun rôle, pas même l'administrateur
-- d'un monde, n'a de raison de lire le fournisseur d'un autre compte.
create policy ai_providers_select on ai_providers for select
  using (user_id = auth.uid());
create policy ai_providers_insert on ai_providers for insert
  with check (user_id = auth.uid());
create policy ai_providers_update on ai_providers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy ai_providers_delete on ai_providers for delete
  using (user_id = auth.uid());

comment on table ai_providers is
  'V3.1-224 (ADR 0103) : le fournisseur d''IA déclaré par un compte. `secret` est chiffré par l''application, jamais rendu au client.';
