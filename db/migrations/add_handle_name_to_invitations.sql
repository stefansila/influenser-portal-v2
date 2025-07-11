-- Add handle_name column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS handle_name TEXT; 