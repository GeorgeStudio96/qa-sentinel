import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20250930172513_create_form_test_scenarios.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying migration...');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    console.log(`\nExecuting: ${statement.substring(0, 50)}...`);

    const { data, error } = await supabase.rpc('exec_sql', {
      query: statement
    });

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    console.log('✓ Success');
  }

  console.log('\n✅ Migration applied successfully!');
}

applyMigration().catch(console.error);
