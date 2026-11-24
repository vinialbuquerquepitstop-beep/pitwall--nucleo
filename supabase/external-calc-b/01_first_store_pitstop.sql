-- EXTERNAL CALC B | 01 first store. Pitstop Imports keeps the id it has in the Núcleo calculator so the versioned
-- calculator migrations that seed its catalogue (e.g. calc_catalogo_jbl) apply unchanged. Suppliers are NOT seeded:
-- the owner's supplier list is commercial data kept out of git (see calc_catalogo_tenant_pitstop.NAO-VERSIONADA.md).
insert into public.tenant(id, nome) values ('00000000-0000-0000-0000-000000000001', 'Pitstop Imports')
on conflict (id) do nothing;
