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
          ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC,
          ADD COLUMN IF NOT EXISTS opening_stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS sold_base_unit NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 5,
          ADD COLUMN IF NOT EXISTS hsn_sac TEXT,
          ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS low_stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS supplier_id INTEGER
        `,
        sql`
          ALTER TABLE products
          ALTER COLUMN stock TYPE NUMERIC USING stock::NUMERIC
        `,
        sql`
          UPDATE products
          SET
            opening_stock_base_unit = COALESCE(opening_stock_base_unit, stock),
            stock_base_unit = COALESCE(stock_base_unit, stock),
            sold_base_unit = COALESCE(sold_base_unit, 0),
            low_stock_base_unit = COALESCE(low_stock_base_unit, reorder_level, 5)
          WHERE opening_stock_base_unit IS NULL
             OR stock_base_unit IS NULL
             OR sold_base_unit IS NULL
             OR low_stock_base_unit IS NULL
        `,
        sql`
          ALTER TABLE shops
          ADD COLUMN IF NOT EXISTS gstin TEXT,
          ADD COLUMN IF NOT EXISTS default_invoice_type TEXT DEFAULT 'tax_invoice',
          ADD COLUMN IF NOT EXISTS default_payment_method TEXT DEFAULT 'cash',
          ADD COLUMN IF NOT EXISTS default_terms TEXT,
          ADD COLUMN IF NOT EXISTS receipt_size TEXT DEFAULT 'a4',
          ADD COLUMN IF NOT EXISTS print_mode TEXT DEFAULT 'color',
          ADD COLUMN IF NOT EXISTS custom_units JSONB DEFAULT '[]'::jsonb
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
            receipt_url TEXT,
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
            paid_amount NUMERIC NOT NULL DEFAULT 0,
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
            product_id INTEGER,
            product_name_snapshot TEXT,
            movement_type TEXT NOT NULL,
            quantity_change NUMERIC NOT NULL,
            quantity_base_unit NUMERIC,
            display_quantity NUMERIC,
            unit TEXT,
            old_stock_base_unit NUMERIC,
            new_stock_base_unit NUMERIC,
            reason TEXT,
            related_sale_id INTEGER,
            related_purchase_id INTEGER,
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            reference_type TEXT,
            reference_id TEXT,
            notes TEXT,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          ALTER TABLE stock_movements
          DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey
        `,
        sql`
          ALTER TABLE stock_movements
          ALTER COLUMN product_id DROP NOT NULL,
          ALTER COLUMN quantity_change TYPE NUMERIC USING quantity_change::NUMERIC,
          ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS quantity_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS display_quantity NUMERIC,
          ADD COLUMN IF NOT EXISTS unit TEXT,
          ADD COLUMN IF NOT EXISTS old_stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS new_stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS reason TEXT,
          ADD COLUMN IF NOT EXISTS related_sale_id INTEGER,
          ADD COLUMN IF NOT EXISTS related_purchase_id INTEGER,
          ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL
        `,
        sql`
          CREATE TABLE IF NOT EXISTS unit_conversions (
            conversion_id BIGSERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
            from_unit TEXT NOT NULL,
            to_unit TEXT NOT NULL,
            conversion_rate NUMERIC NOT NULL CHECK (conversion_rate > 0),
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (product_id, from_unit, to_unit)
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS payments (
            payment_id BIGSERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            sale_id INTEGER REFERENCES sales(sale_id) ON DELETE SET NULL,
            purchase_id INTEGER REFERENCES purchases(purchase_id) ON DELETE SET NULL,
            customer_id INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
            supplier_id INTEGER REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
            amount NUMERIC NOT NULL CHECK (amount > 0),
            payment_method TEXT NOT NULL DEFAULT 'cash',
            direction TEXT NOT NULL CHECK (direction IN ('received', 'paid')),
            notes TEXT,
            payment_date DATE DEFAULT CURRENT_DATE,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS ai_logs (
            ai_log_id BIGSERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            request_type TEXT NOT NULL,
            prompt_summary TEXT,
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
          ALTER COLUMN total_quantity TYPE NUMERIC USING total_quantity::NUMERIC
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
          ALTER TABLE customers
          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
        `,
        sql`
          ALTER TABLE suppliers
          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
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
        sql`
          CREATE INDEX IF NOT EXISTS payments_shop_created_idx
          ON payments (shop_id, created_at DESC)
        `,
      ])
      .catch((error) => {
        featureSchemaPromise = undefined;
        throw error;
      });
  }

  return featureSchemaPromise;
}
