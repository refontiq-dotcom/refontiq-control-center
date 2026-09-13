// Chek grants PG sur table users (remote CC)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing var'); process.exit(1); }

const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await sb.rpc('exec_sql', {
  sql: `SELECT grantee, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY grantee, privilege_type`,
});
if (error) { console.log('exec_sql failed :', error.message); }
console.log(JSON.stringify(data, null, 2));
