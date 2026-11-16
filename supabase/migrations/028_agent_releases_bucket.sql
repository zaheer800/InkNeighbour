-- Private bucket for the InkNeighbour Connect Windows agent download.
-- No storage policies are created on purpose: nobody can read it directly. Signed-in users get a
-- short-lived signed URL from the agent-download edge function (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-releases', 'agent-releases', false, 157286400, array['application/zip'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
