import sql from "@/app/api/utils/sql";

let coreSchemaPromise;
let featureSchemaPromise;

export function ensureCoreBusinessSchema() {
  if (!coreSchemaPromise) {
    coreSchemaPromise = (async () => {
      const queries = [
        `CREATE TABLE IF NOT EXISTS shop_memberships (
            membership_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            shop_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            role VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            invited_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE (shop_id, user_id),
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
            FOREIGN KEY (invited_by) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS audit_events (
            audit_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            shop_id VARCHAR(36),
            actor_id VARCHAR(36),
            actor_role VARCHAR(50),
            action TEXT NOT NULL,
            resource_type VARCHAR(50),
            resource_id VARCHAR(255),
            metadata JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (actor_id) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS team_invitations (
            invite_id BIGINT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            invited_email VARCHAR(255) NOT NULL,
            invited_name TEXT,
            role VARCHAR(50) NOT NULL,
            token VARCHAR(255) NOT NULL UNIQUE,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            invited_by VARCHAR(36),
            accepted_by VARCHAR(36),
            expires_at DATETIME NOT NULL,
            accepted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (invited_by) REFERENCES auth_users(id) ON DELETE SET NULL,
            FOREIGN KEY (accepted_by) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE INDEX shop_memberships_user_shop_idx ON shop_memberships (user_id, shop_id);`,
        `CREATE INDEX audit_events_shop_created_idx ON audit_events (shop_id, created_at);`,
        `CREATE INDEX team_invitations_shop_email_status_idx ON team_invitations (shop_id, invited_email, status);`,
        `CREATE INDEX team_invitations_token_idx ON team_invitations (token);`
      ];

      for (const query of queries) {
        try {
          await sql(query);
        } catch (e) {
          // Ignore index already exists errors
          if (e.code !== 'ER_DUP_KEYNAME') console.error(e);
        }
      }
    })();
  }
  return coreSchemaPromise;
}

export async function ensureBusinessFeatureSchema() {
  await ensureCoreBusinessSchema();
  if (!featureSchemaPromise) {
    featureSchemaPromise = (async () => {
      const queries = [
        `CREATE TABLE IF NOT EXISTS customers (
            customer_id INT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            email VARCHAR(255),
            gstin VARCHAR(50),
            address TEXT,
            opening_balance DECIMAL(15,2) DEFAULT 0,
            notes TEXT,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS suppliers (
            supplier_id INT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            owner_id VARCHAR(36),
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            email VARCHAR(255),
            gstin VARCHAR(50),
            address TEXT,
            opening_balance DECIMAL(15,2) DEFAULT 0,
            upi_id VARCHAR(255),
            qr_image_url LONGTEXT,
            custom_fields JSON,
            due_date DATE,
            payment_status VARCHAR(50) DEFAULT 'due',
            notes TEXT,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS categories (
            category_id INT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            owner_id VARCHAR(36),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            icon VARCHAR(255),
            color VARCHAR(50),
            product_count INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS expenses (
            expense_id INT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            owner_id VARCHAR(36),
            expense_date DATE DEFAULT (CURRENT_DATE),
            category VARCHAR(255) NOT NULL,
            amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            gst_included BOOLEAN DEFAULT FALSE,
            payment_method VARCHAR(50) DEFAULT 'cash',
            vendor VARCHAR(255),
            notes TEXT,
            receipt_url LONGTEXT,
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS purchases (
            purchase_id INT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            owner_id VARCHAR(36),
            supplier_id INT,
            bill_number VARCHAR(255),
            purchase_date DATE DEFAULT (CURRENT_DATE),
            items JSON,
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            payment_status VARCHAR(50) DEFAULT 'paid',
            paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            due_date DATE,
            notes TEXT,
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS stock_movements (
            movement_id BIGINT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            product_id INT,
            product_name_snapshot TEXT,
            movement_type VARCHAR(50) NOT NULL,
            quantity_change DECIMAL(15,2) NOT NULL,
            quantity_base_unit DECIMAL(15,2),
            display_quantity DECIMAL(15,2),
            unit VARCHAR(50),
            batch_id BIGINT,
            old_stock_base_unit DECIMAL(15,2),
            new_stock_base_unit DECIMAL(15,2),
            cost_price_snapshot DECIMAL(15,2),
            selling_price_snapshot DECIMAL(15,2),
            movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            related_sale_id INT,
            related_purchase_id INT,
            owner_id VARCHAR(36),
            reference_type VARCHAR(50),
            reference_id VARCHAR(255),
            notes TEXT,
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS product_batches (
            batch_id BIGINT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            shop_id VARCHAR(36) NOT NULL,
            owner_id VARCHAR(36),
            product_name_snapshot TEXT NOT NULL,
            purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            quantity_purchased DECIMAL(15,2) NOT NULL DEFAULT 0,
            quantity_remaining DECIMAL(15,2) NOT NULL DEFAULT 0,
            quantity_purchased_base_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
            quantity_remaining_base_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
            unit VARCHAR(50) NOT NULL DEFAULT 'piece',
            primary_unit_snapshot VARCHAR(50),
            secondary_unit_snapshot VARCHAR(50),
            conversion_rate_snapshot DECIMAL(15,4),
            cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,
            cost_price_base_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
            selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
            supplier_id INT,
            supplier_name_snapshot TEXT,
            purchase_invoice_no VARCHAR(255),
            notes TEXT,
            source VARCHAR(50) DEFAULT 'purchase',
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS estimates (
            estimate_id BIGINT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            owner_id VARCHAR(36),
            estimate_number VARCHAR(255) NOT NULL,
            customer_id INT,
            customer_name TEXT,
            customer_phone VARCHAR(50),
            customer_email VARCHAR(255),
            customer_gstin VARCHAR(50),
            billing_address TEXT,
            place_of_supply VARCHAR(255),
            valid_until DATE,
            items JSON,
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
            discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            taxable_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            cgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            sgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            igst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            notes TEXT,
            terms TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'draft',
            converted_sale_id INT,
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE (shop_id, estimate_number),
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE SET NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS payments (
            payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
            shop_id VARCHAR(36) NOT NULL,
            sale_id INT,
            purchase_id INT,
            customer_id INT,
            supplier_id INT,
            amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            payment_method VARCHAR(50) DEFAULT 'cash',
            direction VARCHAR(50) DEFAULT 'received',
            notes TEXT,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
        )`
      ];

      for (const query of queries) {
        try {
          await sql(query);
        } catch (e) {
          if (e.code !== 'ER_DUP_KEYNAME') console.error(e);
        }
      }

      // Add missing columns to sales table (schema drift fix)
      const salesAlters = [
        'ALTER TABLE sales ADD COLUMN customer_id INT',
        'ALTER TABLE sales ADD COLUMN customer_email VARCHAR(255)',
        'ALTER TABLE sales ADD COLUMN customer_gstin VARCHAR(50)',
        'ALTER TABLE sales ADD COLUMN billing_address TEXT',
        'ALTER TABLE sales ADD COLUMN place_of_supply VARCHAR(255)',
        'ALTER TABLE sales ADD COLUMN customer_state_code VARCHAR(10)',
        'ALTER TABLE sales ADD COLUMN invoice_type VARCHAR(50) DEFAULT "invoice"',
        'ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN taxable_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN cgst_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN sgst_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN igst_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN gst_breakdown JSON',
        'ALTER TABLE sales ADD COLUMN paid_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN due_date DATE',
        'ALTER TABLE sales ADD COLUMN sale_status VARCHAR(50) DEFAULT "completed"',
        'ALTER TABLE sales ADD COLUMN currency_snapshot VARCHAR(20) DEFAULT "INR"',
        'ALTER TABLE sales ADD COLUMN tax_percent_snapshot DECIMAL(10,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN shop_snapshot JSON',
        'ALTER TABLE sales ADD COLUMN checkout_session_id VARCHAR(255)',
        'ALTER TABLE sales ADD COLUMN receipt_email_sent BOOLEAN DEFAULT FALSE',
        'ALTER TABLE sales ADD COLUMN receipt_email_sent_at DATETIME',
        'ALTER TABLE sales ADD COLUMN receipt_email_error TEXT',
        'ALTER TABLE sales ADD COLUMN email_message_id VARCHAR(255)',
      ];
      for (const alter of salesAlters) {
        try { await sql(alter); } catch (e) { /* column might already exist */ }
      }
    })();
  }
  return featureSchemaPromise;
}
