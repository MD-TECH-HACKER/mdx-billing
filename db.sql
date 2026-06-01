-- Auth Tables
CREATE TABLE IF NOT EXISTS auth_users (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  email VARCHAR(255) UNIQUE,
  emailVerified DATETIME,
  image TEXT
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36),
  type TEXT,
  provider VARCHAR(255),
  providerAccountId VARCHAR(255),
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  password TEXT,
  UNIQUE(provider, providerAccountId),
  FOREIGN KEY (userId) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(36) PRIMARY KEY,
  sessionToken VARCHAR(255) UNIQUE,
  userId VARCHAR(36),
  expires DATETIME,
  FOREIGN KEY (userId) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_verification_token (
  identifier VARCHAR(255),
  token VARCHAR(255),
  expires DATETIME,
  PRIMARY KEY (identifier, token)
);

-- Core Business Tables
CREATE TABLE IF NOT EXISTS shops (
  shop_id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36),
  shop_name TEXT,
  shop_description TEXT,
  shop_logo LONGTEXT,
  address TEXT,
  phone TEXT,
  email VARCHAR(255),
  currency TEXT,
  receipt_prefix VARCHAR(50) DEFAULT 'INV',
  tax_percent DECIMAL(10,2) DEFAULT 0,
  thank_you_message TEXT,
  theme TEXT,
  accent_color TEXT,
  gstin TEXT,
  default_invoice_type VARCHAR(50) DEFAULT 'tax_invoice',
  default_payment_method VARCHAR(50) DEFAULT 'cash',
  default_terms TEXT,
  receipt_size VARCHAR(50) DEFAULT 'a4',
  print_mode VARCHAR(50) DEFAULT 'color',
  custom_units JSON DEFAULT ('[]'),
  drive_connected BOOLEAN DEFAULT false,
  drive_email TEXT,
  drive_last_synced DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shop_memberships (
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
);

CREATE TABLE IF NOT EXISTS audit_events (
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
);

CREATE TABLE IF NOT EXISTS team_invitations (
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
);

CREATE TABLE IF NOT EXISTS customers (
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
);

CREATE TABLE IF NOT EXISTS suppliers (
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
);

CREATE TABLE IF NOT EXISTS categories (
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
);

CREATE TABLE IF NOT EXISTS products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id VARCHAR(36),
  shop_id VARCHAR(36),
  image_url LONGTEXT,
  title TEXT,
  description TEXT,
  selling_price DECIMAL(15,2) DEFAULT 0,
  cost_price DECIMAL(15,2) DEFAULT 0,
  stock DECIMAL(15,2) DEFAULT 0,
  category TEXT,
  category_id BIGINT,
  category_name_snapshot TEXT,
  sku VARCHAR(255),
  primary_unit VARCHAR(50) DEFAULT 'piece',
  secondary_unit VARCHAR(50),
  conversion_rate DECIMAL(15,4),
  opening_stock_base_unit DECIMAL(15,2),
  stock_base_unit DECIMAL(15,2),
  sold_base_unit DECIMAL(15,2) DEFAULT 0,
  reorder_level DECIMAL(15,2) DEFAULT 5,
  low_stock_base_unit DECIMAL(15,2),
  hsn_sac VARCHAR(255),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  tax_mode VARCHAR(50) DEFAULT 'inclusive',
  gst_exempt BOOLEAN DEFAULT FALSE,
  cess_rate DECIMAL(5,2) DEFAULT 0,
  reverse_charge BOOLEAN DEFAULT FALSE,
  product_status VARCHAR(50) DEFAULT 'active',
  supplier_id INT,
  product_created_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  sale_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id VARCHAR(36),
  shop_id VARCHAR(36),
  customer_id INT,
  customer_email VARCHAR(255),
  customer_gstin VARCHAR(50),
  billing_address TEXT,
  place_of_supply VARCHAR(255),
  customer_state_code VARCHAR(10),
  invoice_type VARCHAR(50) DEFAULT 'invoice',
  receipt_number VARCHAR(255),
  buyer_name TEXT,
  buyer_phone TEXT,
  items JSON,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) DEFAULT 0,
  total_profit DECIMAL(15,2) DEFAULT 0,
  total_quantity INT DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  gst_breakdown JSON,
  payment_status VARCHAR(50),
  payment_method VARCHAR(50),
  paid_amount DECIMAL(15,2) DEFAULT 0,
  due_date DATE,
  sale_status VARCHAR(50) DEFAULT 'completed',
  currency_snapshot VARCHAR(20) DEFAULT 'INR',
  tax_percent_snapshot DECIMAL(10,2) DEFAULT 0,
  shop_snapshot JSON,
  checkout_session_id VARCHAR(255),
  receipt_email_sent BOOLEAN DEFAULT FALSE,
  receipt_email_sent_at DATETIME,
  receipt_email_error TEXT,
  email_message_id VARCHAR(255),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
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
);

CREATE TABLE IF NOT EXISTS purchases (
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
);

CREATE TABLE IF NOT EXISTS stock_movements (
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
);

CREATE TABLE IF NOT EXISTS unit_conversions (
  conversion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id VARCHAR(36) NOT NULL,
  product_id INT NOT NULL,
  from_unit VARCHAR(50) NOT NULL,
  to_unit VARCHAR(50) NOT NULL,
  conversion_rate DECIMAL(15,4) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(product_id, from_unit, to_unit),
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_batches (
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
);

CREATE TABLE IF NOT EXISTS estimates (
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
);

CREATE TABLE IF NOT EXISTS payments (
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
);

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value LONGTEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banned_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) UNIQUE,
  reason TEXT,
  banned_by VARCHAR(36),
  banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id VARCHAR(36),
  user_id VARCHAR(36),
  request_type VARCHAR(50),
  prompt_summary TEXT,
  tokens_used INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS shop_memberships_user_shop_idx ON shop_memberships (user_id, shop_id);
CREATE INDEX IF NOT EXISTS audit_events_shop_created_idx ON audit_events (shop_id, created_at);
CREATE INDEX IF NOT EXISTS team_invitations_shop_email_status_idx ON team_invitations (shop_id, invited_email, status);
CREATE INDEX IF NOT EXISTS team_invitations_token_idx ON team_invitations (token);
