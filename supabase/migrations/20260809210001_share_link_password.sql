-- V1-C4 (specs/arbitrage-modifications.md §3.2) — mot de passe optionnel sur
-- un lien de partage. Le jeton reste le secret principal ; le mot de passe
-- est une seconde barriere optionnelle. Hachage seul (jamais le mot de
-- passe en clair), meme regle que le jeton (SCHEMA.md §18) — mais un mot de
-- passe choisi par un humain est bien plus faible qu'un jeton aleatoire de
-- 256 bits, donc un simple SHA-256 ne suffit pas ici : le hachage se fait
-- cote application avec scrypt (node:crypto, deja natif — pas de nouvelle
-- dependance), sale, stocke en un seul champ texte auto-descriptif
-- ("scrypt$<sel>$<hachage>"). Postgres ne fait que le stocker et compter
-- les tentatives.
alter table share_links
  add column password_hash text,
  add column password_attempts int not null default 0;

comment on column share_links.password_hash is 'Hachage scrypt sale ("scrypt$sel$hachage"), calcule cote application. NULL = pas de mot de passe.';
comment on column share_links.password_attempts is 'Tentatives echouees consecutives depuis la derniere reussite — limite la force brute (specs/arbitrage-modifications.md §3.2).';

-- Postgres refuse un CREATE OR REPLACE qui change les colonnes de sortie
-- (OUT parameters) d'une fonction existante — DROP explicite d'abord.
drop function if exists public.resolve_share_link(text);
drop function if exists app.resolve_share_link(text);

create function app.resolve_share_link(p_token text)
returns table (
  world_id uuid,
  world_name text,
  world_slug text,
  scope text,
  password_hash text,
  password_attempts int
)
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  return query
    select w.id, w.name, w.slug, sl.scope, sl.password_hash, sl.password_attempts
    from share_links sl
    join worlds w on w.id = sl.world_id
    where sl.token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > now());
end;
$$;

create function public.resolve_share_link(p_token text)
returns table (
  world_id uuid,
  world_name text,
  world_slug text,
  scope text,
  password_hash text,
  password_attempts int
)
language sql
stable
security invoker
set search_path = public
as $$
  select * from app.resolve_share_link(p_token);
$$;

revoke execute on function public.resolve_share_link(text) from public;
grant execute on function public.resolve_share_link(text) to anon, authenticated;

-- Enregistre une tentative de mot de passe : incremente sur echec, remet a
-- zero sur reussite. Fonction dediee (jamais un update direct depuis
-- l'application, qui n'a pas d'acces RLS a share_links en anonyme) —
-- meme motif que resolve_share_link.
create or replace function app.record_share_link_password_attempt(p_token text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  update share_links
  set password_attempts = case when p_success then 0 else password_attempts + 1 end
  where token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
    and revoked_at is null;
end;
$$;

revoke execute on function app.record_share_link_password_attempt(text, boolean) from public;
grant execute on function app.record_share_link_password_attempt(text, boolean) to anon, authenticated;

create or replace function public.record_share_link_password_attempt(p_token text, p_success boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  select app.record_share_link_password_attempt(p_token, p_success);
$$;

revoke execute on function public.record_share_link_password_attempt(text, boolean) from public;
grant execute on function public.record_share_link_password_attempt(text, boolean) to anon, authenticated;
