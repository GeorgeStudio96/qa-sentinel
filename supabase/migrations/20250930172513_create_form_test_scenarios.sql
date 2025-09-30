-- Create form_test_scenarios table for storing test data presets
CREATE TABLE form_test_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_type TEXT NOT NULL CHECK (preset_type IN ('simple', 'realistic')),
  preset_name TEXT NOT NULL,
  preset_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preset_name)
);

-- Create indexes for performance
CREATE INDEX idx_form_test_scenarios_user_id ON form_test_scenarios(user_id);
CREATE INDEX idx_form_test_scenarios_active ON form_test_scenarios(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE form_test_scenarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own scenarios"
  ON form_test_scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios"
  ON form_test_scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON form_test_scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON form_test_scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_form_test_scenarios_updated_at
  BEFORE UPDATE ON form_test_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
