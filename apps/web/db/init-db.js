import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function init() {
  console.log("Creating tables...");
  
  try {
    const connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id VARCHAR(36) PRIMARY KEY,
        name TEXT,
        display_name TEXT,
        email VARCHAR(255) UNIQUE,
        emailVerified DATETIME,
        image TEXT
      );
    `);
    
    await connection.query(`
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
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id VARCHAR(36) PRIMARY KEY,
        sessionToken VARCHAR(255) UNIQUE,
        userId VARCHAR(36),
        expires DATETIME,
        FOREIGN KEY (userId) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_verification_token (
        identifier VARCHAR(255),
        token VARCHAR(255),
        expires DATETIME,
        PRIMARY KEY (identifier, token)
      );
    `);

    await connection.query(`
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
    `);

    await connection.query(`
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
        supplier_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        sale_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id VARCHAR(36),
        shop_id VARCHAR(36),
        receipt_number VARCHAR(255),
        buyer_name TEXT,
        buyer_phone TEXT,
        items JSON,
        total_amount DECIMAL(15,2) DEFAULT 0,
        total_cost DECIMAL(15,2) DEFAULT 0,
        total_profit DECIMAL(15,2) DEFAULT 0,
        total_quantity INT DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        payment_status VARCHAR(50),
        payment_method VARCHAR(50),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
      );
    `);

    console.log("Tables created successfully!");
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

init();
