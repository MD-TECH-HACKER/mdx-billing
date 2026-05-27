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
          CREATE TABLE IF NOT EXISTS team_invitations (
            invite_id BIGSERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            invited_email TEXT NOT NULL,
            invited_name TEXT,
            role TEXT NOT NULL CHECK (role IN ('manager', 'cashier')),
            token TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
            invited_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            accepted_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            expires_at TIMESTAMP NOT NULL,
            accepted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
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
          ADD COLUMN IF NOT EXISTS supplier_id INTEGER,
          ADD COLUMN IF NOT EXISTS category_id INTEGER,
          ADD COLUMN IF NOT EXISTS category_name_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS product_created_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'exclusive',
          ADD COLUMN IF NOT EXISTS gst_exempt BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS cess_rate NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS product_status TEXT DEFAULT 'active'
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
            low_stock_base_unit = COALESCE(low_stock_base_unit, reorder_level, 5),
            product_created_at = COALESCE(product_created_at, created_at, NOW()),
            category_name_snapshot = COALESCE(category_name_snapshot, category),
            gst_rate = COALESCE(gst_rate, tax_rate, 0),
            tax_mode = COALESCE(tax_mode, 'exclusive'),
            product_status = COALESCE(product_status, 'active')
          WHERE opening_stock_base_unit IS NULL
             OR stock_base_unit IS NULL
             OR sold_base_unit IS NULL
             OR low_stock_base_unit IS NULL
             OR product_created_at IS NULL
             OR category_name_snapshot IS NULL
             OR gst_rate IS NULL
             OR tax_mode IS NULL
             OR product_status IS NULL
        `,
        sql`
          ALTER TABLE shops
          ADD COLUMN IF NOT EXISTS gstin TEXT,
          ADD COLUMN IF NOT EXISTS email TEXT,
          ADD COLUMN IF NOT EXISTS default_invoice_type TEXT DEFAULT 'tax_invoice',
          ADD COLUMN IF NOT EXISTS default_payment_method TEXT DEFAULT 'cash',
          ADD COLUMN IF NOT EXISTS default_terms TEXT,
          ADD COLUMN IF NOT EXISTS receipt_size TEXT DEFAULT 'a4',
          ADD COLUMN IF NOT EXISTS print_mode TEXT DEFAULT 'color',
          ADD COLUMN IF NOT EXISTS custom_units JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS send_receipt_email BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS gst_billing_enabled BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS business_legal_name TEXT,
          ADD COLUMN IF NOT EXISTS business_address TEXT,
          ADD COLUMN IF NOT EXISTS state TEXT,
          ADD COLUMN IF NOT EXISTS state_code TEXT,
          ADD COLUMN IF NOT EXISTS default_gst_rate NUMERIC DEFAULT 18,
          ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'exclusive',
          ADD COLUMN IF NOT EXISTS stock_selling_method TEXT DEFAULT 'fifo'
        `,
        sql`
          CREATE INDEX IF NOT EXISTS shop_memberships_user_shop_idx
          ON shop_memberships (user_id, shop_id)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS audit_events_shop_created_idx
          ON audit_events (shop_id, created_at DESC)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS team_invitations_shop_email_status_idx
          ON team_invitations (shop_id, invited_email, status)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS team_invitations_token_idx
          ON team_invitations (token)
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
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            opening_balance NUMERIC DEFAULT 0,
            upi_id TEXT,
            qr_image_url TEXT,
            custom_fields JSONB DEFAULT '[]'::jsonb,
            due_date DATE,
            payment_status TEXT DEFAULT 'due',
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS categories (
            category_id SERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            color TEXT,
            product_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS product_batches (
            batch_id BIGSERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            product_name_snapshot TEXT NOT NULL,
            purchase_date TIMESTAMP DEFAULT NOW(),
            quantity_purchased NUMERIC NOT NULL DEFAULT 0,
            quantity_remaining NUMERIC NOT NULL DEFAULT 0,
            quantity_purchased_base_unit NUMERIC NOT NULL DEFAULT 0,
            quantity_remaining_base_unit NUMERIC NOT NULL DEFAULT 0,
            unit TEXT NOT NULL DEFAULT 'piece',
            primary_unit_snapshot TEXT,
            secondary_unit_snapshot TEXT,
            conversion_rate_snapshot NUMERIC,
            cost_price NUMERIC NOT NULL DEFAULT 0,
            cost_price_base_unit NUMERIC NOT NULL DEFAULT 0,
            selling_price NUMERIC NOT NULL DEFAULT 0,
            supplier_id INTEGER,
            supplier_name_snapshot TEXT,
            purchase_invoice_no TEXT,
            notes TEXT,
            source TEXT DEFAULT 'purchase',
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS expenses (
            expense_id SERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            expense_date DATE DEFAULT CURRENT_DATE,
            category TEXT NOT NULL,
            amount NUMERIC NOT NULL DEFAULT 0,
            gst_included BOOLEAN DEFAULT FALSE,
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
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            supplier_id INTEGER REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
            bill_number TEXT,
            purchase_date DATE DEFAULT CURRENT_DATE,
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            subtotal NUMERIC NOT NULL DEFAULT 0,
            tax_amount NUMERIC NOT NULL DEFAULT 0,
            total_amount NUMERIC NOT NULL DEFAULT 0,
            payment_status TEXT DEFAULT 'paid',
            paid_amount NUMERIC NOT NULL DEFAULT 0,
            due_date DATE,
            notes TEXT,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
        sql`
          ALTER TABLE purchases
          ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS due_date DATE,
          ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL
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
            batch_id BIGINT,
            old_stock_base_unit NUMERIC,
            new_stock_base_unit NUMERIC,
            cost_price_snapshot NUMERIC,
            selling_price_snapshot NUMERIC,
            movement_date TIMESTAMP DEFAULT NOW(),
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
          ADD COLUMN IF NOT EXISTS batch_id BIGINT,
          ADD COLUMN IF NOT EXISTS old_stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS new_stock_base_unit NUMERIC,
          ADD COLUMN IF NOT EXISTS cost_price_snapshot NUMERIC,
          ADD COLUMN IF NOT EXISTS selling_price_snapshot NUMERIC,
          ADD COLUMN IF NOT EXISTS movement_date TIMESTAMP DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS reason TEXT,
          ADD COLUMN IF NOT EXISTS related_sale_id INTEGER,
          ADD COLUMN IF NOT EXISTS related_purchase_id INTEGER,
          ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL
        `,
        sql`
          ALTER TABLE stock_movements
          ALTER COLUMN quantity_base_unit TYPE NUMERIC USING quantity_base_unit::NUMERIC,
          ALTER COLUMN display_quantity TYPE NUMERIC USING display_quantity::NUMERIC,
          ALTER COLUMN old_stock_base_unit TYPE NUMERIC USING old_stock_base_unit::NUMERIC,
          ALTER COLUMN new_stock_base_unit TYPE NUMERIC USING new_stock_base_unit::NUMERIC
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
          ADD COLUMN IF NOT EXISTS due_date DATE,
          ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'invoice',
          ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
          ADD COLUMN IF NOT EXISTS billing_address TEXT,
          ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
          ADD COLUMN IF NOT EXISTS customer_state_code TEXT,
          ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS igst_amount NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS gst_breakdown JSONB DEFAULT '{}'::jsonb
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
          ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
          ADD COLUMN IF NOT EXISTS customer_email TEXT,
          ADD COLUMN IF NOT EXISTS receipt_email_sent BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS receipt_email_sent_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS receipt_email_error TEXT,
          ADD COLUMN IF NOT EXISTS email_message_id TEXT
        `,
        sql`
          ALTER TABLE customers
          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
        `,
        sql`
          ALTER TABLE suppliers
          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS upi_id TEXT,
          ADD COLUMN IF NOT EXISTS qr_image_url TEXT,
          ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS due_date DATE,
          ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'due'
        `,
        sql`
          CREATE TABLE IF NOT EXISTS estimates (
            estimate_id BIGSERIAL PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            estimate_number TEXT NOT NULL,
            customer_id INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
            customer_name TEXT,
            customer_phone TEXT,
            customer_email TEXT,
            customer_gstin TEXT,
            billing_address TEXT,
            place_of_supply TEXT,
            valid_until DATE,
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            subtotal NUMERIC NOT NULL DEFAULT 0,
            discount_amount NUMERIC NOT NULL DEFAULT 0,
            taxable_amount NUMERIC NOT NULL DEFAULT 0,
            tax_amount NUMERIC NOT NULL DEFAULT 0,
            cgst_amount NUMERIC NOT NULL DEFAULT 0,
            sgst_amount NUMERIC NOT NULL DEFAULT 0,
            igst_amount NUMERIC NOT NULL DEFAULT 0,
            total_amount NUMERIC NOT NULL DEFAULT 0,
            notes TEXT,
            terms TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            converted_sale_id INTEGER,
            created_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (shop_id, estimate_number)
          )
        `,
        sql`
          INSERT INTO product_batches
            (product_id, shop_id, owner_id, product_name_snapshot, purchase_date,
             quantity_purchased, quantity_remaining, quantity_purchased_base_unit, quantity_remaining_base_unit,
             unit, primary_unit_snapshot, secondary_unit_snapshot, conversion_rate_snapshot,
             cost_price, cost_price_base_unit, selling_price, supplier_id, purchase_invoice_no,
             notes, source, created_at, updated_at)
          SELECT p.product_id, p.shop_id, p.owner_id, p.title,
            COALESCE(p.product_created_at, p.created_at, NOW()),
            CASE WHEN p.conversion_rate > 0 THEN COALESCE(p.stock_base_unit, p.stock) / p.conversion_rate ELSE COALESCE(p.stock_base_unit, p.stock) END,
            CASE WHEN p.conversion_rate > 0 THEN COALESCE(p.stock_base_unit, p.stock) / p.conversion_rate ELSE COALESCE(p.stock_base_unit, p.stock) END,
            COALESCE(p.stock_base_unit, p.stock), COALESCE(p.stock_base_unit, p.stock),
            COALESCE(p.primary_unit, 'piece'), COALESCE(p.primary_unit, 'piece'), p.secondary_unit, p.conversion_rate,
            COALESCE(p.cost_price, 0),
            CASE WHEN p.conversion_rate > 0 THEN COALESCE(p.cost_price, 0) / p.conversion_rate ELSE COALESCE(p.cost_price, 0) END,
            COALESCE(p.selling_price, 0), p.supplier_id, NULL,
            'Backfilled from existing current stock', 'legacy_opening', COALESCE(p.created_at, NOW()), NOW()
          FROM products p
          WHERE COALESCE(p.stock_base_unit, p.stock, 0) > 0
            AND NOT EXISTS (
              SELECT 1 FROM product_batches b
              WHERE b.product_id = p.product_id AND b.shop_id = p.shop_id
            )
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
          CREATE INDEX IF NOT EXISTS categories_shop_name_idx
          ON categories (shop_id, name)
        `,
        sql`
          CREATE UNIQUE INDEX IF NOT EXISTS categories_shop_lower_name_idx
          ON categories (shop_id, LOWER(name))
        `,
        sql`
          CREATE INDEX IF NOT EXISTS product_batches_shop_product_idx
          ON product_batches (shop_id, product_id, purchase_date ASC, batch_id ASC)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS estimates_shop_created_idx
          ON estimates (shop_id, created_at DESC)
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
