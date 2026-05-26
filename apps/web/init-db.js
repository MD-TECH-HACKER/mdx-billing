import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function init() {
  console.log("Creating tables...");
  
  await sql`
    CREATE TABLE IF NOT EXISTS auth_users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT,
      display_name TEXT,
      email TEXT UNIQUE,
      "emailVerified" TIMESTAMP,
      image TEXT
    );
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS auth_accounts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "userId" UUID REFERENCES auth_users(id) ON DELETE CASCADE,
      type TEXT,
      provider TEXT,
      "providerAccountId" TEXT,
      refresh_token TEXT,
      access_token TEXT,
      expires_at BIGINT,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      password TEXT,
      UNIQUE(provider, "providerAccountId")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "sessionToken" TEXT UNIQUE,
      "userId" UUID REFERENCES auth_users(id) ON DELETE CASCADE,
      expires TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_verification_token (
      identifier TEXT,
      token TEXT,
      expires TIMESTAMP,
      PRIMARY KEY (identifier, token)
    );
  `;

  console.log("Tables created successfully!");
}

init().catch(console.error);
