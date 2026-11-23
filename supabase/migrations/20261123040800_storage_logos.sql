-- =====================================================================
-- Storage: logos das empresas
-- =====================================================================
--
-- Bucket público: qualquer pessoa vê o logo pelo link, como uma imagem
-- comum do site. Gravar, trocar e apagar só a própria empresa (na pasta
-- com o id dela, ex.: "<id da empresa>/logo.png") ou o admin.
--
-- Limites: 1 MB por arquivo e só PNG, JPEG ou WebP. SVG fica de fora
-- porque pode carregar código escondido.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Logos: empresa vê os próprios arquivos; admin vê todos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1] = (select privado.minha_empresa_id())::text
         or (select privado.eh_admin()))
  );

create policy "Logos: empresa envia na própria pasta; admin em qualquer uma" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1] = (select privado.minha_empresa_id())::text
         or (select privado.eh_admin()))
  );

create policy "Logos: empresa troca os próprios arquivos; admin troca todos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1] = (select privado.minha_empresa_id())::text
         or (select privado.eh_admin()))
  )
  with check (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1] = (select privado.minha_empresa_id())::text
         or (select privado.eh_admin()))
  );

create policy "Logos: empresa apaga os próprios arquivos; admin apaga todos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1] = (select privado.minha_empresa_id())::text
         or (select privado.eh_admin()))
  );
