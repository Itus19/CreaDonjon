-- Diagnostic TEMPORAIRE (isolation extreme) : desactive completement la
-- RLS sur `entities` pour confirmer, sans le moindre doute, que le blocage
-- vient bien de cette table et pas d'un mecanisme ailleurs (cascade,
-- trigger, autre politique) qui reutiliserait le meme message d'erreur.
alter table entities disable row level security;
