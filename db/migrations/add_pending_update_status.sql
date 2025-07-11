-- Add pending_update to response_status enum
ALTER TYPE response_status ADD VALUE IF NOT EXISTS 'pending' AFTER 'rejected';
ALTER TYPE response_status ADD VALUE IF NOT EXISTS 'pending_update' AFTER 'pending'; 