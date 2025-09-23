-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sites table
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  webflow_site_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scans table
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  findings_count INTEGER DEFAULT 0
);

-- Findings table
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- broken-image, form-error, visual-regression
  severity TEXT NOT NULL, -- high, medium, low
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB, -- Screenshots URLs, diffs, logs
  created_at TIMESTAMP DEFAULT NOW()
);

-- Baselines table for visual regression
CREATE TABLE baselines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  viewport TEXT NOT NULL,
  screenshot_url TEXT NOT NULL, -- Supabase Storage URL
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(site_id, url, viewport)
);

-- Create storage buckets for screenshots and baselines
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('screenshots', 'screenshots', true),
  ('baselines', 'baselines', true);

-- Allow public read access to storage buckets
CREATE POLICY "Public read access for screenshots" ON storage.objects
FOR SELECT USING (bucket_id = 'screenshots');

CREATE POLICY "Public read access for baselines" ON storage.objects
FOR SELECT USING (bucket_id = 'baselines');

-- Allow authenticated users to manage their files
CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Authenticated users can upload baselines" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'baselines');

-- Add indexes for better performance
CREATE INDEX idx_scans_site_id ON scans(site_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_findings_scan_id ON findings(scan_id);
CREATE INDEX idx_findings_type ON findings(type);
CREATE INDEX idx_baselines_site_id ON baselines(site_id);