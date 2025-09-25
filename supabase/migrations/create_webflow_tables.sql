-- Create table for storing Webflow OAuth tokens
CREATE TABLE IF NOT EXISTS webflow_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one token per user
  UNIQUE(user_id)
);

-- Create table for storing authorized Webflow sites
CREATE TABLE IF NOT EXISTS webflow_sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  domain TEXT,
  workspace_id TEXT,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique site per user
  UNIQUE(user_id, site_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_webflow_tokens_user_id ON webflow_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_webflow_sites_user_id ON webflow_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_webflow_sites_site_id ON webflow_sites(site_id);

-- Enable Row Level Security (RLS)
ALTER TABLE webflow_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE webflow_sites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webflow_tokens
CREATE POLICY "Users can view own tokens" ON webflow_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON webflow_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON webflow_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON webflow_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for webflow_sites
CREATE POLICY "Users can view own sites" ON webflow_sites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sites" ON webflow_sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sites" ON webflow_sites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sites" ON webflow_sites
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for webflow_tokens
CREATE TRIGGER update_webflow_tokens_updated_at
  BEFORE UPDATE ON webflow_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();