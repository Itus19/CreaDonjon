-- Bug reel trouve en testant le retablissement d'une fiche (retour
-- utilisateur) : creer une nouvelle fiche echouait parfois avec une brute
-- "duplicate key value violates unique constraint entities_world_id_slug_key"
-- (500 non gere). Cause : `generateUniqueEntitySlug` verifie l'unicite via
-- `worldHasSlug`, une requete normale sous RLS -- `entities_select` masque
-- justement les fiches supprimees (`deleted_at is not null`), donc ce
-- controle les traite comme "slug libre" alors que la contrainte
-- d'unicite Postgres, elle, ne filtre jamais par `deleted_at`. Une fiche
-- supprimee garde son slug pour toujours (necessaire pour le
-- retablissement, ADR 0019) : le controle d'unicite doit donc voir TOUTES
-- les lignes, supprimees comprises.
--
-- Meme patron que `public.soft_delete_entity`/`public.restore_entity` :
-- `security definer` + `row_security = off`. Verifie l'appartenance au
-- monde (pas de fuite d'existence de slug entre mondes), mais aucune
-- verification MJ/edition necessaire au-dela -- juste un booleen, jamais
-- une donnee de la fiche elle-meme.
create or replace function public.world_has_slug(p_world_id uuid, p_slug text)
returns boolean
language plpgsql security definer set search_path = public, app set row_security = off as $$
begin
  if not app.is_world_member(p_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return exists (select 1 from entities where world_id = p_world_id and slug = p_slug);
end;
$$;

revoke execute on function public.world_has_slug(uuid, text) from public;
grant execute on function public.world_has_slug(uuid, text) to authenticated;
