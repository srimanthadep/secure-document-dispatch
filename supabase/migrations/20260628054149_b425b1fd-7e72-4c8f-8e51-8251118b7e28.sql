
create policy "authenticated can manage templates bucket"
  on storage.objects for all to authenticated
  using (bucket_id = 'templates')
  with check (bucket_id = 'templates');

create policy "authenticated can manage signed-pdfs bucket"
  on storage.objects for all to authenticated
  using (bucket_id = 'signed-pdfs')
  with check (bucket_id = 'signed-pdfs');
