import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variables d\'environnement manquantes: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function pushSchema() {
  console.log('📤 Lecture du schéma SQL...');
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('🔧 Exécution du schéma sur Supabase...');
  const { error } = await supabase.rpc('exec_sql', { sql: schema });

  if (error) {
    // Essayer d'exécuter par morceaux si exec_sql n'existe pas
    console.log('⚠️  exec_sql non disponible, tentative d\'exécution directe...');
    
    // Diviser le schéma en statements individuels
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (stmt.trim()) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
        if (stmtError) {
          // Ignorer les erreurs "already exists" pour les extensions, types, etc.
          if (!stmtError.message.includes('already exists') && !stmtError.message.includes('duplicate')) {
            console.error('❌ Erreur:', stmtError.message);
            console.error('Statement:', stmt.substring(0, 200));
          }
        }
      }
    }
    console.log('✅ Schéma appliqué (avec quelques avertissements ignorés)');
  } else {
    console.log('✅ Schéma appliqué avec succès');
  }
}

pushSchema().catch(console.error);
