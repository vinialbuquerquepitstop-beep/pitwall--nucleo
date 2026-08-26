-- migration aplicada: 20260826014913_fin_fatia1_bucket_extrato
-- Bucket PRIVADO para o extrato OFX. PII pesada de terceiros (nome de quem pagou PIX):
-- nunca publico, e aqui a policy e mais estrita que a do bucket nf: DONO-ONLY.
-- allowed_mime_types fica NULL de proposito: .ofx chega como x-ofx, octet-stream,
-- text/plain ou string vazia dependendo do navegador, e whitelist apertada aqui
-- vira upload que falha sem motivo visivel. A contencao e o bucket privado + a
-- policy dono-only + o teto de 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('extrato', 'extrato', false, 10485760, null)
on conflict (id) do nothing;

drop policy if exists extrato_obj_sel on storage.objects;
drop policy if exists extrato_obj_ins on storage.objects;

create policy extrato_obj_sel on storage.objects for select to authenticated
  using (
    bucket_id = 'extrato'
    and (storage.foldername(name))[1] = (privado.fn_tenant_atual())::text
    and privado.fn_papel_atual() = 'dono'
  );

create policy extrato_obj_ins on storage.objects for insert to authenticated
  with check (
    bucket_id = 'extrato'
    and (storage.foldername(name))[1] = (privado.fn_tenant_atual())::text
    and privado.fn_papel_atual() = 'dono'
  );
