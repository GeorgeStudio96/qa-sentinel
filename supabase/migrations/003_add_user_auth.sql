-- Add user authentication support to sites table
-- This migration adds user_id column and RLS policies

-- Add user_id column to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Enable Row Level Security on existing tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;

-- Sites policies: users can only see their own sites
CREATE POLICY "Users can manage their own sites" ON sites
  FOR ALL USING (auth.uid() = user_id);

-- Scans policies: users can only see scans of their sites
CREATE POLICY "Users can manage scans of their sites" ON scans
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id = auth.uid()
    )
  );

-- Findings policies: users can only see findings of their scans
CREATE POLICY "Users can view findings of their scans" ON findings
  FOR SELECT USING (
    scan_id IN (
      SELECT s.id FROM scans s
      JOIN sites st ON s.site_id = st.id
      WHERE st.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert findings" ON findings
  FOR INSERT WITH CHECK (true);

-- Baselines policies: users can only see baselines of their sites
CREATE POLICY "Users can manage baselines of their sites" ON baselines
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id = auth.uid()
    )
  );

-- Update storage policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload baselines" ON storage.objects;

CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload baselines" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'baselines' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their files" ON storage.objects
  FOR DELETE USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON COLUMN sites.user_id IS 'Foreign key to auth.users - owner of this site';