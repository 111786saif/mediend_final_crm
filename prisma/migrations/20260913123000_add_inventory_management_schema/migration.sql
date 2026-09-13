-- CreateTable
CREATE TABLE "inventory_workspaces" (
    "workspace_id" TEXT NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_workspaces_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "inventory_audit_events" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_audit_events_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_command_receipts" (
    "workspace_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "body_hash" TEXT NOT NULL,
    "revision" BIGINT NOT NULL,

    CONSTRAINT "inventory_command_receipts_pkey" PRIMARY KEY ("workspace_id","request_id")
);

-- CreateTable
CREATE TABLE "inventory_vendors" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_vendors_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_products" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_purchases" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_purchases_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_sales" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_sales_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_deliveries" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_deliveries_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_payments" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_payments_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_attachments" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_attachments_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateTable
CREATE TABLE "inventory_attachment_bytes" (
    "workspace_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "inventory_attachment_bytes_pkey" PRIMARY KEY ("workspace_id","id")
);

-- CreateIndex
CREATE INDEX "inventory_audit_events_workspace_id_at_idx" ON "inventory_audit_events"("workspace_id", "at");
