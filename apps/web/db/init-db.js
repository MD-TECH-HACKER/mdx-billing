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

  await sql`
    CREATE TABLE IF NOT EXISTS shops (
      shop_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
      shop_name TEXT,
      shop_description TEXT,
      shop_logo TEXT,
      address TEXT,
      phone TEXT,
      currency TEXT,
      receipt_prefix TEXT DEFAULT 'INV',
      tax_percent NUMERIC DEFAULT 0,
      thank_you_message TEXT,
      theme TEXT,
      accent_color TEXT,
      drive_connected BOOLEAN DEFAULT false,
      drive_email TEXT,
      drive_last_synced TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      product_id SERIAL PRIMARY KEY,
      owner_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
      shop_id UUID REFERENCES shops(shop_id) ON DELETE CASCADE,
      image_url TEXT,
      title TEXT,
      description TEXT,
      selling_price NUMERIC DEFAULT 0,
      cost_price NUMERIC DEFAULT 0,
      stock INTEGER DEFAULT 0,
      category TEXT,
      sku TEXT,
      primary_unit TEXT DEFAULT 'piece',
      secondary_unit TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sales (
      sale_id SERIAL PRIMARY KEY,
      owner_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
      shop_id UUID REFERENCES shops(shop_id) ON DELETE CASCADE,
      receipt_number TEXT,
      buyer_name TEXT,
      buyer_phone TEXT,
      items JSONB,
      total_amount NUMERIC DEFAULT 0,
      total_cost NUMERIC DEFAULT 0,
      total_profit NUMERIC DEFAULT 0,
      total_quantity INTEGER DEFAULT 0,
      tax_amount NUMERIC DEFAULT 0,
      payment_status TEXT,
      payment_method TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  console.log("Tables created successfully!");
}

init().catch(console.error);
