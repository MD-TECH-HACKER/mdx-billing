import sql from "@/app/api/utils/sql";

let coreSchemaPromise;
let featureSchemaPromise;

export function ensureCoreBusinessSchema() {
  if (!coreSchemaPromise) {
    coreSchemaPromise = sql
      .transaction([
        sql`
          CREATE TABLE IF NOT EXISTS shop_memberships (
            membership_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('manager', 'cashier')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
            invited_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (shop_id, user_id)
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS audit_events (
            audit_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            shop_id UUID REFERENCES shops(shop_id) ON DELETE CASCADE,
            actor_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            actor_role TEXT,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          ALTER TABLE products
          ADD COLUMN IF NOT EXISTS primary_unit TEXT DEFAULT 'piece',
          ADD COLUMN IF NOT EXISTS secondary_unit TEXT,
          ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 5,
          ADD COLUMN IF NOT EXISTS hsn_sac TEXT,
          ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0
        `,
        sql`
          CREATE INDEX IF NOT EXISTS shop_memberships_user_shop_idx
          ON shop_memberships (user_id, shop_id)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS audit_events_shop_created_idx
          ON audit_events (shop_id, created_at DESC)
        `,
      ])
      .catch((error) => {
        coreSchemaPromise = undefined;
        throw error;
      });
  }

  return coreSchemaPromise;
}

export async function ensureBusinessFeatureSchema() {
  await ensureCoreBusinessSchema();

  if (!featureSchemaPromise) {
    featureSchemaPromise = sql
      .transaction([
        sql`
          CREATE TABLE IF NOT EXISTS customers (
            customer_id SERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            opening_balance NUMERIC DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS suppliers (
            supplier_id SERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            opening_balance NUMERIC DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS expenses (
            expense_id SERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            expense_date DATE DEFAULT CURRENT_DATE,
            category TEXT NOT NULL,
            amount NUMERIC NOT NULL DEFAULT 0,
            payment_method TEXT DEFAULT 'cash',
            vendor TEXT,
            notes TEXT,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS purchases (
            purchase_id SERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            supplier_id INTEGER REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
            bill_number TEXT,
            purchase_date DATE DEFAULT CURRENT_DATE,
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            subtotal NUMERIC NOT NULL DEFAULT 0,
            tax_amount NUMERIC NOT NULL DEFAULT 0,
            total_amount NUMERIC NOT NULL DEFAULT 0,
            payment_status TEXT DEFAULT 'paid',
            notes TEXT,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS stock_movements (
            movement_id BIGSERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
            movement_type TEXT NOT NULL,
            quantity_change INTEGER NOT NULL,
            reference_type TEXT,
            reference_id TEXT,
            notes TEXT,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          ALTER TABLE sales
          ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS due_date DATE
        `,
        sql`
          ALTER TABLE sales
          ADD COLUMN IF NOT EXISTS sale_status TEXT DEFAULT 'completed',
          ADD COLUMN IF NOT EXISTS currency_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS tax_percent_snapshot NUMERIC,
          ADD COLUMN IF NOT EXISTS shop_snapshot JSONB DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS checkout_session_id TEXT
        `,
        sql`
          CREATE UNIQUE INDEX IF NOT EXISTS sales_checkout_session_idx
          ON sales (checkout_session_id) WHERE checkout_session_id IS NOT NULL
        `,
        sql`
          CREATE INDEX IF NOT EXISTS customers_shop_name_idx
          ON customers (shop_id, name)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS suppliers_shop_name_idx
          ON suppliers (shop_id, name)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS expenses_shop_date_idx
          ON expenses (shop_id, expense_date DESC)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS purchases_shop_date_idx
          ON purchases (shop_id, purchase_date DESC)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS stock_movements_shop_created_idx
          ON stock_movements (shop_id, created_at DESC)
        `,
      ])
      .catch((error) => {
        featureSchemaPromise = undefined;
        throw error;
      });
  }

  return featureSchemaPromise;
}
