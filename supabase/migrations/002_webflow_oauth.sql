-- Webflow OAuth Integration Tables
-- Migration for Epic 9: Webflow OAuth Integration

-- OAuth States table for CSRF protection
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'webflow', 'slack', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL
);

-- Webflow Connections table
CREATE TABLE webflow_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  webflow_user_id TEXT NOT NULL,
  webflow_user_email TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted in production
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT NOT NULL,
  connected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT true,

  -- Prevent multiple connections for same user/webflow account
  UNIQUE(user_id, webflow_user_id)
);

-- Webflow Sites Cache table (from API)
CREATE TABLE webflow_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES webflow_connections(id) ON DELETE CASCADE,
  webflow_site_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  short_name TEXT,
  domain TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  preview_url TEXT,
  custom_domains JSONB DEFAULT '[]',
  timezone TEXT,
  locales JSONB DEFAULT '{}',
  created_on TIMESTAMP,
  last_updated TIMESTAMP,
  published_on TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  is_accessible BOOLEAN DEFAULT true
);

-- Webflow Pages Cache table (from API)
CREATE TABLE webflow_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES webflow_sites(id) ON DELETE CASCADE,
  webflow_page_id TEXT NOT NULL UNIQUE,
  webflow_site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT NULL,
  locale_id TEXT NOT NULL,
  created_on TIMESTAMP,
  last_updated TIMESTAMP,
  last_published TIMESTAMP,
  can_branch BOOLEAN DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  og_title TEXT,
  og_description TEXT,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Webflow Forms Cache table (from API)
CREATE TABLE webflow_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES webflow_sites(id) ON DELETE CASCADE,
  webflow_form_id TEXT NOT NULL UNIQUE,
  webflow_site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  page_id TEXT NOT NULL,
  workflow_id TEXT NULL,
  created_on TIMESTAMP,
  fields JSONB DEFAULT '[]',
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Sites table to link with Webflow
ALTER TABLE sites ADD COLUMN IF NOT EXISTS webflow_site_id TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES webflow_connections(id);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS last_webflow_sync TIMESTAMP;

-- Indexes for performance
CREATE INDEX idx_oauth_states_user_id ON oauth_states(user_id);
CREATE INDEX idx_oauth_states_state ON oauth_states(state);
CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);

CREATE INDEX idx_webflow_connections_user_id ON webflow_connections(user_id);
CREATE INDEX idx_webflow_connections_webflow_user_id ON webflow_connections(webflow_user_id);
CREATE INDEX idx_webflow_connections_is_active ON webflow_connections(is_active);

CREATE INDEX idx_webflow_sites_connection_id ON webflow_sites(connection_id);
CREATE INDEX idx_webflow_sites_webflow_site_id ON webflow_sites(webflow_site_id);
CREATE INDEX idx_webflow_sites_domain ON webflow_sites(domain);

CREATE INDEX idx_webflow_pages_site_id ON webflow_pages(site_id);
CREATE INDEX idx_webflow_pages_webflow_page_id ON webflow_pages(webflow_page_id);
CREATE INDEX idx_webflow_pages_webflow_site_id ON webflow_pages(webflow_site_id);
CREATE INDEX idx_webflow_pages_slug ON webflow_pages(slug);

CREATE INDEX idx_webflow_forms_site_id ON webflow_forms(site_id);
CREATE INDEX idx_webflow_forms_webflow_form_id ON webflow_forms(webflow_form_id);
CREATE INDEX idx_webflow_forms_webflow_site_id ON webflow_forms(webflow_site_id);

CREATE INDEX idx_sites_webflow_site_id ON sites(webflow_site_id);
CREATE INDEX idx_sites_connection_id ON sites(connection_id);

-- Row Level Security (RLS) Policies
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE webflow_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE webflow_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE webflow_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webflow_forms ENABLE ROW LEVEL SECURITY;

-- OAuth States policies
CREATE POLICY "Users can manage their own OAuth states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);

-- Webflow Connections policies
CREATE POLICY "Users can manage their own Webflow connections" ON webflow_connections
  FOR ALL USING (auth.uid() = user_id);

-- Webflow Sites policies (through connection ownership)
CREATE POLICY "Users can access their connected Webflow sites" ON webflow_sites
  FOR SELECT USING (
    connection_id IN (
      SELECT id FROM webflow_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their connected Webflow sites" ON webflow_sites
  FOR UPDATE USING (
    connection_id IN (
      SELECT id FROM webflow_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert Webflow sites" ON webflow_sites
  FOR INSERT WITH CHECK (true);

-- Webflow Pages policies (through site ownership)
CREATE POLICY "Users can access pages of their connected sites" ON webflow_pages
  FOR SELECT USING (
    site_id IN (
      SELECT ws.id FROM webflow_sites ws
      JOIN webflow_connections wc ON ws.connection_id = wc.id
      WHERE wc.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage Webflow pages" ON webflow_pages
  FOR ALL WITH CHECK (true);

-- Webflow Forms policies (through site ownership)
CREATE POLICY "Users can access forms of their connected sites" ON webflow_forms
  FOR SELECT USING (
    site_id IN (
      SELECT ws.id FROM webflow_sites ws
      JOIN webflow_connections wc ON ws.connection_id = wc.id
      WHERE wc.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage Webflow forms" ON webflow_forms
  FOR ALL WITH CHECK (true);

-- Function to cleanup expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update webflow_connections timestamp
CREATE OR REPLACE FUNCTION update_webflow_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamps
CREATE TRIGGER update_webflow_connections_timestamp
  BEFORE UPDATE ON webflow_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_webflow_connection_timestamp();

-- Comments for documentation
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth CSRF protection states';
COMMENT ON TABLE webflow_connections IS 'Webflow OAuth connections with encrypted access tokens';
COMMENT ON TABLE webflow_sites IS 'Cached Webflow sites data from API';
COMMENT ON TABLE webflow_pages IS 'Cached Webflow pages data from API';
COMMENT ON TABLE webflow_forms IS 'Cached Webflow forms data from API';

COMMENT ON COLUMN webflow_connections.access_token IS 'Encrypted OAuth access token for Webflow API';
COMMENT ON COLUMN webflow_sites.custom_domains IS 'JSON array of custom domain names';
COMMENT ON COLUMN webflow_sites.locales IS 'JSON object with primary and secondary locales';
COMMENT ON COLUMN webflow_pages.seo_title IS 'SEO meta title from Webflow';
COMMENT ON COLUMN webflow_pages.og_title IS 'Open Graph title from Webflow';
COMMENT ON COLUMN webflow_forms.fields IS 'JSON array of form field definitions from Webflow API';