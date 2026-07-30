-- Migration 010 — RAG : chunks et file d'embeddings (SCHEMA.md §17).

-- vector(1024) correspond aux modeles Voyage (l'API Claude ne fournit pas
-- d'endpoint d'embeddings). Le chunking est deja fait par le modele de
-- donnees : un chunk = un segment, un bloc, une entree de regle.
create table chunks (
  id            uuid primary key default gen_random_uuid(),
  world_id      uuid not null references worlds(id) on delete cascade,
  source_kind   text not null check (source_kind in
                  ('entity_summary','narrative_segment','block','ruleset_entry','session_summary')),
  source_id     uuid not null,
  content       text not null,
  content_hash  text not null,
  token_count   int,
  visibility_level text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,
  embedding       vector(1024),
  embedding_model text,
  embedded_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (source_kind, source_id, content_hash)
);

-- La visibilite est recopiee sur le chunk : sinon la recherche vectorielle
-- contourne toutes les permissions (meme piege que sur entity_mentions, §7.1).
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_world_idx     on chunks (world_id, source_kind);
create index chunks_pending_idx   on chunks (world_id) where embedding is null;

-- Jamais d'appel d'embedding dans la transaction d'ecriture : trigger vers
-- cette file, job separe qui la vide.
create table embedding_queue (
  id          bigserial primary key,
  chunk_id    uuid not null references chunks(id) on delete cascade,
  attempts    int not null default 0,
  last_error  text,
  enqueued_at timestamptz not null default now()
);
