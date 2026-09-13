import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SUPER_ADMIN_EMAIL;
const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
  console.error('❌ Variables manquantes: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPER_ADMIN_EMAIL');
  process.exit(1);
}

if (!adminPassword) {
  console.warn('⚠️  SUPER_ADMIN_PASSWORD non défini dans .env.local — le script va générer un mot de passe aléatoire.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createSuperAdmin() {
  console.log(`🔧 Super Admin: ${adminEmail}`);

  // Mot de passe : utiliser SUPER_ADMIN_PASSWORD si défini, sinon générer aléatoire
  const password = adminPassword || crypto.randomBytes(16).toString('base64url').slice(0, 16);
  console.log(`🔑 Mot de passe utilisé: ${password}`);
  
  // 1. Créer l'utilisateur dans Supabase Auth
  let alreadyExists = false;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: password,
    email_confirm: true,
    user_metadata: { full_name: 'Super Admin Refontiq' },
  });

  if (authError) {
    // Supabase renvoie "A user with this email address has already been registered"
    if (/already( been)? registered/i.test(authError.message)) {
      console.log('⚠️  Utilisateur déjà existant dans Auth');
      alreadyExists = true;
    } else {
      console.error('❌ Erreur Auth:', authError.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Utilisateur créé dans Supabase Auth');
  }

  // 2. Récupérer l'auth_user_id
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const authUser = users.find(u => u.email === adminEmail);
  
  if (!authUser) {
    console.error('❌ Impossible de récupérer l\'utilisateur Auth');
    process.exit(1);
  }

  // 2bis. Compte existant : réinitialiser le mot de passe pour transmettre
  // des identifiants valides (le mot de passe généré n'est jamais connu avant).
  if (alreadyExists) {
    const { error: resetError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Super Admin Refontiq' },
    });
    if (resetError) {
      console.error('❌ Réinitialisation du mot de passe:', resetError.message);
      process.exit(1);
    }
    console.log('✅ Mot de passe réinitialisé pour le compte existant');
  }

  // 3. Créer/Mettre à jour le profil dans la table users
  // NB: pas de password_hash en base — l'authentification passe par Supabase
  // Auth (signInWithPassword côté /api/admin-login). Stocker le mot de passe
  // en clair dans `users` serait une faille et la colonne n'existe pas.
  const { error: profileError } = await supabase
    .from('users')
    .upsert({
      auth_user_id: authUser.id,
      role: 'super_admin',
      full_name: 'Super Admin Refontiq',
      email: adminEmail,
      is_active: true,
    }, { onConflict: 'auth_user_id' });

  if (profileError) {
    console.error('❌ Erreur profil:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Profil Super Admin créé/mis à jour');
  console.log('\n🔐 Identifiants de connexion:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Mot de passe: ${password}`);
  console.log('\n⚠️  IMPORTANT: Sauvegardez ce mot de passe ! Il ne sera plus affiché.');
  console.log('   Connectez-vous sur /admin avec ce mot de passe uniquement (pas d\'email demandé).');
}

createSuperAdmin().catch(console.error);
