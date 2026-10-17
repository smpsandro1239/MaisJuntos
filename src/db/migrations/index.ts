import { Client } from '@libsql/client';

export interface Migration {
  version: string;
  name: string;
  up: (client: Client) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: '001',
    name: 'create_schema_migrations_and_core_tables',
    up: async (client: Client) => {
      // 1. Tabela de controlo de migrações
      await client.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // 2. Tabela de utilizadores com credenciais com hash seguro
      await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'parent',
          trust_score INTEGER DEFAULT 90,
          avatar TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 3. Tabela de sessões HTTP-only seguras
      await client.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          user_agent TEXT,
          ip TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // 4. Tabela de contas externas OAuth
      await client.execute(`
        CREATE TABLE IF NOT EXISTS oauth_accounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // 5. Tabelas principais POIs, Reports e App State
      await client.execute(`
        CREATE TABLE IF NOT EXISTS pois (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT NOT NULL,
          slug TEXT,
          category TEXT,
          categoryLabel TEXT,
          shortDescription TEXT,
          fullDescription TEXT,
          coverImage TEXT,
          galleryImages TEXT,
          address TEXT,
          concelho TEXT,
          district TEXT,
          latitude REAL,
          longitude REAL,
          distanceMinutes INTEGER,
          distanceKm REAL,
          minAge INTEGER,
          maxAge INTEGER,
          priceChild REAL,
          priceAdult REAL,
          priceFamily REAL,
          isFree INTEGER,
          isOpenNow INTEGER,
          openingHoursSummary TEXT,
          spaceType TEXT,
          amenities TEXT,
          dataQualityScore INTEGER,
          status TEXT,
          source TEXT,
          requiresBooking INTEGER,
          wheelchairAccessible INTEGER,
          strollerFriendly INTEGER,
          phone TEXT,
          website TEXT,
          data TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          code TEXT,
          poiId TEXT,
          poiName TEXT,
          issueType TEXT,
          issueLabel TEXT,
          description TEXT,
          reporterName TEXT,
          reporterRole TEXT,
          reporterTrustScore INTEGER,
          status TEXT,
          reportedAgo TEXT,
          fieldChanged TEXT,
          oldValue TEXT,
          newValue TEXT,
          data TEXT,
          createdAt TEXT
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS user_favorites (
          userId TEXT,
          poiId TEXT,
          createdAt TEXT,
          PRIMARY KEY (userId, poiId)
        );
      `);
    },
  },
  {
    version: '002',
    name: 'add_data_json_column_to_pois_and_reports',
    up: async (client: Client) => {
      try {
        await client.execute('ALTER TABLE pois ADD COLUMN data TEXT');
      } catch {
        // Coluna já existente
      }
      try {
        await client.execute('ALTER TABLE reports ADD COLUMN data TEXT');
      } catch {
        // Coluna já existente
      }
    },
  },
  {
    version: '003',
    name: 'create_family_plans_table',
    up: async (client: Client) => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS family_plans (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          plan_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      await client.execute('CREATE INDEX IF NOT EXISTS idx_family_plans_user ON family_plans(user_id)');
    },
  },
  {
    version: '004',
    name: 'add_email_verification_reset_tokens_and_login_lockout',
    up: async (client: Client) => {
      // Colunas de verificação de email e proteção contra força bruta.
      try {
        await client.execute('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
      } catch {
        // Coluna já existente
      }
      try {
        await client.execute('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
      } catch {
        // Coluna já existente
      }
      try {
        await client.execute('ALTER TABLE users ADD COLUMN locked_until TEXT');
      } catch {
        // Coluna já existente
      }

      // Tokens de uso único (verificação de email e reposição de palavra-passe).
      // Guarda-se apenas o HASH do token — o valor em claro só viaja no email.
      await client.execute(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      await client.execute('CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id)');
    },
  },
  {
    version: '005',
    name: 'add_report_photos',
    up: async (client: Client) => {
      // Comprovativos fotográficos dos reportes da comunidade. Tabela separada
      // para não inflar a listagem pública de reportes (o binário só é pedido
      // sob procura via GET /api/reports/:id/photo).
      await client.execute(`
        CREATE TABLE IF NOT EXISTS report_photos (
          reportId TEXT PRIMARY KEY,
          mime TEXT NOT NULL,
          data TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
      `);
    },
  },
];

export async function runMigrations(client: Client): Promise<void> {
  // Garantir existência da tabela schema_migrations
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await client.execute('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(appliedRows.rows.map((r: any) => String(r.version)));

  for (const mig of migrations) {
    if (!appliedVersions.has(mig.version)) {
      console.log(`[Migrations] A executar migração versionada ${mig.version}: ${mig.name}...`);
      await mig.up(client);
      await client.execute({
        sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        args: [mig.version, mig.name, new Date().toISOString()],
      });
      console.log(`[Migrations] Migração ${mig.version} concluída com sucesso.`);
    }
  }
}
