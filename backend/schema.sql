-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Base Tables (Examples matching SQLite)

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    api_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    server_id UUID UNIQUE, -- Can map to local UUID if initiated offline
    category_id UUID,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    destination VARCHAR(50) DEFAULT '1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at BIGINT, -- Milliseconds epoch to match JS
    deleted_at BIGINT -- For soft deletes
);
CREATE INDEX idx_products_updated ON products(store_id, updated_at);

-- Sales
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    server_id UUID UNIQUE,
    check_number INTEGER,
    date TIMESTAMP,
    total_amount DECIMAL(10, 2),
    payment_method VARCHAR(50),
    waiter_name VARCHAR(255),
    items_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at BIGINT,
    deleted_at BIGINT
);
CREATE INDEX idx_sales_updated ON sales(store_id, updated_at);

-- Sync Log (Optional audit)
CREATE TABLE sync_audit (
    id SERIAL PRIMARY KEY,
    store_id UUID,
    action VARCHAR(50),
    table_name VARCHAR(50),
    record_id UUID,
    occurred_at TIMESTAMP DEFAULT NOW()
);
