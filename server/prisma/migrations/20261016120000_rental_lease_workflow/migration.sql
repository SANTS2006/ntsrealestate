-- Rent and lease workflow: payment plan, renewal, ending, and a record of every instalment.
ALTER TABLE "deals"
  ADD COLUMN "start_date"            DATE,
  ADD COLUMN "end_date"              DATE,
  ADD COLUMN "payment_frequency"     TEXT,            -- 'monthly' | 'yearly'
  ADD COLUMN "installment_amount"    NUMERIC(14,2),
  ADD COLUMN "security_deposit"      NUMERIC(14,2),
  ADD COLUMN "renewal_count"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "renewal_requested_at"  TIMESTAMPTZ,
  ADD COLUMN "ended_at"              TIMESTAMPTZ,
  ADD COLUMN "end_reason"            TEXT,            -- 'cancelled' | 'moved_out' | 'expired'
  ADD COLUMN "end_note"              TEXT,
  ADD COLUMN "ended_by_id"           UUID;

CREATE TABLE "deal_installments" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "deal_id"              UUID NOT NULL REFERENCES "deals"("id") ON DELETE CASCADE,
  "sequence"             INTEGER NOT NULL,
  "due_date"             DATE NOT NULL,
  "amount"               NUMERIC(14,2) NOT NULL,
  "paid_amount"          NUMERIC(14,2) NOT NULL DEFAULT 0,
  "status"               TEXT NOT NULL DEFAULT 'pending',  -- pending | partial | paid | cancelled
  "paid_at"              TIMESTAMPTZ,
  "reminded_at"          TIMESTAMPTZ,
  "overdue_notified_at"  TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "deal_installments_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "deal_installments_paid_not_negative" CHECK ("paid_amount" >= 0)
);
CREATE UNIQUE INDEX "deal_installments_deal_sequence" ON "deal_installments" ("deal_id", "sequence");
CREATE INDEX "deal_installments_due_open_idx" ON "deal_installments" ("due_date") WHERE "status" IN ('pending', 'partial');
