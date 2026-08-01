-- Suppression de compte (V1-A1b, menu de reglages) : une fonction
-- security definer plutot qu'un client service-role en TypeScript. Le
-- client service-role est confine a src/server/services/publicShare.ts
-- (CLAUDE.md regle 4 ter) ; passer par une fonction SQL evite d'avoir a
-- elargir cette confinement pour un besoin qui se resout entierement
-- cote base.
--
-- Portee reelle aujourd'hui (application a usage personnel, pas encore
-- de collaboration multi-utilisateur active — "Inviter un MJ" reste
-- desactive) : un compte ne possede que ses propres mondes. La fonction
-- supprime les mondes du compte (cascade sur entities/blocks/relations/
-- campaigns/..., verifie via SCHEMA.md §3 et les migrations existantes),
-- puis ses rulesets maison (rulesets n'a pas de world_id, donc pas
-- couvert par la cascade des mondes), puis le compte lui-meme.
--
-- Ce que cette fonction NE gere PAS explicitement : les lignes ou ce
-- compte est reference comme created_by/gm_user_id/etc. dans le monde
-- de quelqu'un d'autre (blocks.created_by, campaigns.gm_user_id,
-- ai_proposals.reviewed_by, etc. — aucune n'a de cascade sur
-- auth.users). Tant qu'aucune vraie collaboration n'existe, ce cas ne
-- se produit jamais en pratique ; s'il se produisait, la suppression
-- finale de auth.users echoue avec une erreur de contrainte, dans une
-- transaction annulee en entier — jamais une suppression partielle.
create or replace function app.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Aucun utilisateur authentifie';
  end if;

  delete from worlds where owner_id = caller_id;
  delete from rulesets where created_by = caller_id and is_official_base = false;
  delete from auth.users where id = caller_id;
end;
$$;

revoke all on function app.delete_own_account() from public;
grant execute on function app.delete_own_account() to authenticated;
