-- Step 1: Drop ALL policies on storage.objects (any name)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', rec.policyname);
  END LOOP;
END $$;

-- Step 2: Create policies for rilaxy-media (anon role)
CREATE POLICY "anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'rilaxy-media');

CREATE POLICY "anon_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'rilaxy-media');

CREATE POLICY "anon_update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'rilaxy-media')
  WITH CHECK (bucket_id = 'rilaxy-media');

CREATE POLICY "anon_delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'rilaxy-media');

-- Step 3: Create policies for rilaxy-media (authenticated role)
CREATE POLICY "auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rilaxy-media');

CREATE POLICY "auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rilaxy-media');

CREATE POLICY "auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rilaxy-media')
  WITH CHECK (bucket_id = 'rilaxy-media');

CREATE POLICY "auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rilaxy-media');

-- Step 4: Grant table-level permissions
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;
