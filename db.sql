-- MDX Billing App Database Schema Dump
-- Generated after full MySQL refactoring

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `audit_events`
DROP TABLE IF EXISTS `audit_events`;
CREATE TABLE `audit_events` (
  `audit_id` varchar(36) NOT NULL DEFAULT (uuid()),
  `shop_id` varchar(36) DEFAULT NULL,
  `actor_id` varchar(36) DEFAULT NULL,
  `actor_role` varchar(50) DEFAULT NULL,
  `action` text NOT NULL,
  `resource_type` varchar(50) DEFAULT NULL,
  `resource_id` varchar(255) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `actor_id` (`actor_id`),
  KEY `audit_events_shop_created_idx` (`shop_id`,`created_at`),
  CONSTRAINT `audit_events_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `audit_events_ibfk_2` FOREIGN KEY (`actor_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `auth_accounts`
DROP TABLE IF EXISTS `auth_accounts`;
CREATE TABLE `auth_accounts` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `type` text,
  `provider` varchar(255) DEFAULT NULL,
  `providerAccountId` varchar(255) DEFAULT NULL,
  `refresh_token` text,
  `access_token` text,
  `expires_at` bigint DEFAULT NULL,
  `token_type` text,
  `scope` text,
  `id_token` text,
  `session_state` text,
  `password` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `provider` (`provider`,`providerAccountId`),
  KEY `userId` (`userId`),
  CONSTRAINT `auth_accounts_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `auth_sessions`
DROP TABLE IF EXISTS `auth_sessions`;
CREATE TABLE `auth_sessions` (
  `id` varchar(36) NOT NULL,
  `sessionToken` varchar(255) DEFAULT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessionToken` (`sessionToken`),
  KEY `userId` (`userId`),
  CONSTRAINT `auth_sessions_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `auth_users`
DROP TABLE IF EXISTS `auth_users`;
CREATE TABLE `auth_users` (
  `id` varchar(36) NOT NULL,
  `name` text,
  `display_name` text,
  `email` varchar(255) DEFAULT NULL,
  `emailVerified` datetime DEFAULT NULL,
  `image` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `auth_verification_token`
DROP TABLE IF EXISTS `auth_verification_token`;
CREATE TABLE `auth_verification_token` (
  `identifier` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires` datetime DEFAULT NULL,
  PRIMARY KEY (`identifier`,`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `categories`
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `icon` varchar(255) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `product_count` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  KEY `shop_id` (`shop_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `categories_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `customers`
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `gstin` varchar(50) DEFAULT NULL,
  `address` text,
  `opening_balance` decimal(15,2) DEFAULT '0.00',
  `notes` text,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  KEY `shop_id` (`shop_id`),
  CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `estimates`
DROP TABLE IF EXISTS `estimates`;
CREATE TABLE `estimates` (
  `estimate_id` bigint NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `estimate_number` varchar(255) NOT NULL,
  `customer_id` int DEFAULT NULL,
  `customer_name` text,
  `customer_phone` varchar(50) DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `customer_gstin` varchar(50) DEFAULT NULL,
  `billing_address` text,
  `place_of_supply` varchar(255) DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `items` json DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `taxable_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `cgst_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `sgst_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `igst_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `notes` text,
  `terms` text,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `converted_sale_id` int DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`estimate_id`),
  UNIQUE KEY `shop_id` (`shop_id`,`estimate_number`),
  KEY `owner_id` (`owner_id`),
  KEY `customer_id` (`customer_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `estimates_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `estimates_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `estimates_ibfk_3` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE SET NULL,
  CONSTRAINT `estimates_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `expenses`
DROP TABLE IF EXISTS `expenses`;
CREATE TABLE `expenses` (
  `expense_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `expense_date` date DEFAULT (curdate()),
  `category` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `gst_included` tinyint(1) DEFAULT '0',
  `payment_method` varchar(50) DEFAULT 'cash',
  `vendor` varchar(255) DEFAULT NULL,
  `notes` text,
  `receipt_url` longtext,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_id`),
  KEY `shop_id` (`shop_id`),
  KEY `owner_id` (`owner_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `product_batches`
DROP TABLE IF EXISTS `product_batches`;
CREATE TABLE `product_batches` (
  `batch_id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `product_name_snapshot` text NOT NULL,
  `purchase_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `quantity_purchased` decimal(15,2) NOT NULL DEFAULT '0.00',
  `quantity_remaining` decimal(15,2) NOT NULL DEFAULT '0.00',
  `quantity_purchased_base_unit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `quantity_remaining_base_unit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `unit` varchar(50) NOT NULL DEFAULT 'piece',
  `primary_unit_snapshot` varchar(50) DEFAULT NULL,
  `secondary_unit_snapshot` varchar(50) DEFAULT NULL,
  `conversion_rate_snapshot` decimal(15,4) DEFAULT NULL,
  `cost_price` decimal(15,2) NOT NULL DEFAULT '0.00',
  `cost_price_base_unit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `selling_price` decimal(15,2) NOT NULL DEFAULT '0.00',
  `supplier_id` int DEFAULT NULL,
  `supplier_name_snapshot` text,
  `purchase_invoice_no` varchar(255) DEFAULT NULL,
  `notes` text,
  `source` varchar(50) DEFAULT 'purchase',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`),
  KEY `shop_id` (`shop_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `product_batches_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `product_batches_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `products`
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` varchar(36) DEFAULT NULL,
  `shop_id` varchar(36) DEFAULT NULL,
  `image_url` longtext,
  `title` text,
  `description` text,
  `selling_price` decimal(15,2) DEFAULT '0.00',
  `cost_price` decimal(15,2) DEFAULT '0.00',
  `stock` decimal(15,2) DEFAULT '0.00',
  `category` text,
  `sku` varchar(255) DEFAULT NULL,
  `primary_unit` varchar(50) DEFAULT 'piece',
  `secondary_unit` varchar(50) DEFAULT NULL,
  `conversion_rate` decimal(15,4) DEFAULT NULL,
  `opening_stock_base_unit` decimal(15,2) DEFAULT NULL,
  `stock_base_unit` decimal(15,2) DEFAULT NULL,
  `sold_base_unit` decimal(15,2) DEFAULT '0.00',
  `reorder_level` decimal(15,2) DEFAULT '5.00',
  `low_stock_base_unit` decimal(15,2) DEFAULT NULL,
  `hsn_sac` varchar(255) DEFAULT NULL,
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `supplier_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`),
  KEY `owner_id` (`owner_id`),
  KEY `shop_id` (`shop_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `purchases`
DROP TABLE IF EXISTS `purchases`;
CREATE TABLE `purchases` (
  `purchase_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `bill_number` varchar(255) DEFAULT NULL,
  `purchase_date` date DEFAULT (curdate()),
  `items` json DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `payment_status` varchar(50) DEFAULT 'paid',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `due_date` date DEFAULT NULL,
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`purchase_id`),
  KEY `shop_id` (`shop_id`),
  KEY `owner_id` (`owner_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `purchases_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchases_ibfk_3` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`) ON DELETE SET NULL,
  CONSTRAINT `purchases_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `sales`
DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `sale_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` varchar(36) DEFAULT NULL,
  `shop_id` varchar(36) DEFAULT NULL,
  `receipt_number` varchar(255) DEFAULT NULL,
  `buyer_name` text,
  `buyer_phone` text,
  `items` json DEFAULT NULL,
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `total_cost` decimal(15,2) DEFAULT '0.00',
  `total_profit` decimal(15,2) DEFAULT '0.00',
  `total_quantity` int DEFAULT '0',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `payment_status` varchar(50) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sale_id`),
  KEY `owner_id` (`owner_id`),
  KEY `shop_id` (`shop_id`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `shop_memberships`
DROP TABLE IF EXISTS `shop_memberships`;
CREATE TABLE `shop_memberships` (
  `membership_id` varchar(36) NOT NULL DEFAULT (uuid()),
  `shop_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `role` varchar(50) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `invited_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `shop_id` (`shop_id`,`user_id`),
  KEY `invited_by` (`invited_by`),
  KEY `shop_memberships_user_shop_idx` (`user_id`,`shop_id`),
  CONSTRAINT `shop_memberships_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `shop_memberships_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shop_memberships_ibfk_3` FOREIGN KEY (`invited_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `shops`
DROP TABLE IF EXISTS `shops`;
CREATE TABLE `shops` (
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `shop_name` text,
  `shop_description` text,
  `shop_logo` longtext,
  `address` text,
  `phone` text,
  `currency` text,
  `receipt_prefix` varchar(50) DEFAULT 'INV',
  `tax_percent` decimal(10,2) DEFAULT '0.00',
  `thank_you_message` text,
  `theme` text,
  `accent_color` text,
  `gstin` text,
  `default_invoice_type` varchar(50) DEFAULT 'tax_invoice',
  `default_payment_method` varchar(50) DEFAULT 'cash',
  `default_terms` text,
  `receipt_size` varchar(50) DEFAULT 'a4',
  `print_mode` varchar(50) DEFAULT 'color',
  `custom_units` json DEFAULT (_utf8mb4'[]'),
  `drive_connected` tinyint(1) DEFAULT '0',
  `drive_email` text,
  `drive_last_synced` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`shop_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `shops_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `stock_movements`
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements` (
  `movement_id` bigint NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `product_id` int DEFAULT NULL,
  `product_name_snapshot` text,
  `movement_type` varchar(50) NOT NULL,
  `quantity_change` decimal(15,2) NOT NULL,
  `quantity_base_unit` decimal(15,2) DEFAULT NULL,
  `display_quantity` decimal(15,2) DEFAULT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `batch_id` bigint DEFAULT NULL,
  `old_stock_base_unit` decimal(15,2) DEFAULT NULL,
  `new_stock_base_unit` decimal(15,2) DEFAULT NULL,
  `cost_price_snapshot` decimal(15,2) DEFAULT NULL,
  `selling_price_snapshot` decimal(15,2) DEFAULT NULL,
  `movement_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `reason` text,
  `related_sale_id` int DEFAULT NULL,
  `related_purchase_id` int DEFAULT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`movement_id`),
  KEY `shop_id` (`shop_id`),
  KEY `owner_id` (`owner_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_movements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `suppliers`
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `supplier_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `owner_id` varchar(36) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `gstin` varchar(50) DEFAULT NULL,
  `address` text,
  `opening_balance` decimal(15,2) DEFAULT '0.00',
  `upi_id` varchar(255) DEFAULT NULL,
  `qr_image_url` longtext,
  `custom_fields` json DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `payment_status` varchar(50) DEFAULT 'due',
  `notes` text,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`supplier_id`),
  KEY `shop_id` (`shop_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `suppliers_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `suppliers_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `team_invitations`
DROP TABLE IF EXISTS `team_invitations`;
CREATE TABLE `team_invitations` (
  `invite_id` bigint NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(36) NOT NULL,
  `invited_email` varchar(255) NOT NULL,
  `invited_name` text,
  `role` varchar(50) NOT NULL,
  `token` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `invited_by` varchar(36) DEFAULT NULL,
  `accepted_by` varchar(36) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`invite_id`),
  UNIQUE KEY `token` (`token`),
  KEY `invited_by` (`invited_by`),
  KEY `accepted_by` (`accepted_by`),
  KEY `team_invitations_shop_email_status_idx` (`shop_id`,`invited_email`,`status`),
  KEY `team_invitations_token_idx` (`token`),
  CONSTRAINT `team_invitations_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `team_invitations_ibfk_2` FOREIGN KEY (`invited_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `team_invitations_ibfk_3` FOREIGN KEY (`accepted_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;
