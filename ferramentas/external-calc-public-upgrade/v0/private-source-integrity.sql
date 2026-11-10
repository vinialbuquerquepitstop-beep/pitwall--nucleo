-- UP-V1 existing source integrity: publication must reference a canonical
-- immutable offer revision by tenant, analysis, offer and revision.
-- Non-destructive, no publication rows or privileges created.
ALTER TABLE privado.extcalc_upgrade_publications_v0
 ADD CONSTRAINT upv1_publication_source_revision_fk
 FOREIGN KEY (tenant_id, analysis_id, offer_id, offer_revision)
 REFERENCES public.extcalc_offer_revision(tenant_id, analysis_id, offer_id, offer_revision)
 ON UPDATE RESTRICT ON DELETE RESTRICT;
