# Refontiq Control Center

Hub d'administration centralisé (Super Admin) pour piloter tous les produits Refontiq depuis un seul endroit.

## Produits gérés
- **Séjoura** - Gestion de résidences/hôtels (en production)
- **Schooly** - Gestion scolaire multi-établissements (en développement)
- **Docly** - Gestion de cliniques (en reconstruction)
- **Trouvetou** - Plateforme de découverte grand public (en production)

## Fonctionnalités
- ✅ Authentification Super Admin par **mot de passe seul** (pas d'email)
- ✅ Dashboard consolidé avec métriques par produit (`portfolio_metrics`)
- ✅ Endpoint `POST /api/metrics/push` pour que chaque SaaS pousse ses métriques (clé partagée `METRICS_PUSH_SECRET`)
- ✅ Alertes **Telegram** gratuites/illimitées (via bot)
- ✅ Liens directs vers les consoles d'administration de chaque produit
- ✅ Mode sombre/clair + couleur de marque personnalisable
- ✅ Row Level Security (RLS) stricte

## Architecture
```
refontiq-control-center (repo neutre, propre)
├── src/
│   ├── app/
│   │   ├── admin/              # Pages Super Admin (login + dashboard)
│   │   ├── api/
│   │   │   ├── admin-login/    # Auth par mot de passe seul
│   │   │   └── metrics/push/   # Réception métriques produits
│   ├── components/
│   │   ├── ui/                 # Composants shadcn/ui style
│   │   └── providers/          # Theme provider
│   ├── lib/
│   │   ├── supabase/           # Clients Supabase (client, server, admin)
│   │   ├── telegram.ts         # Utilitaire alertes Telegram
│   │   ├── projects.ts         # Config produits Refontiq
│   │   └── routes.ts           # Routes constantes
│   └── middleware.ts           # Protection routes /admin/*
├── supabase/
│   └── schema.sql              # Schéma DB (users, portfolio_metrics, RLS)
└── scripts/
    ├── db-push.mjs             # Déploiement schéma
    └── create-super-admin.mjs  # Création compte Super Admin
```

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés Supabase, Telegram, etc.

# 3. Pousser le schéma DB
npm run db:push

# 4. Créer le Super Admin
npm run create-super-admin
# Note le mot de passe affiché (ne sera plus montré)

# 5. Lancer en développement
npm run dev
# → http://localhost:3000/admin
```

## Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé anonyme Supabase |
| `SUPABASE_SECRET_KEY` | Clé service role (admin) |
| `SUPER_ADMIN_EMAIL` | Email du compte Super Admin |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram (@BotFather) |
| `TELEGRAM_CHAT_ID` | ID du chat/canal destinataire |
| `TELEGRAM_ADMIN_URL` | URL publique vers /admin/dashboard |
| `METRICS_PUSH_SECRET` | Clé partagée forte (ex: `openssl rand -hex 32`) |

## Intégration produits (ex: Schooly, Séjoura)

Chaque produit doit :
1. Avoir la variable `METRICS_PUSH_SECRET` identique
2. Appeler `POST https://control-center.refontiq.com/api/metrics/push` avec :
```json
{
  "projet": "schooly",
  "nom": "Schooly",
  "mrr": 1500000,
  "comptes_actifs": 42,
  "statut_sante": "healthy",
  "derniere_synchro": "2026-09-19T17:43:00.000Z"
}
```
Header: `Authorization: Bearer <METRICS_PUSH_SECRET>`

## Sécurité
- Middleware protège toutes les routes `/admin/*`
- Vérification rôle `super_admin` + `is_active` en base
- Rate limiting sur `/api/admin-login` (6 tentatives / 10 min par IP)
- RLS sur toutes les tables (lecture Super Admin uniquement)

## Déploiement
- Vercel recommandé (Next.js natif)
- Configurer les variables d'env sur Vercel
- Domaine suggéré : `control-center.refontiq.com`
