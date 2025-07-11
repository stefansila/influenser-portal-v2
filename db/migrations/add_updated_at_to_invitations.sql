-- Add updated_at column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Set default value for existing rows
UPDATE invitations SET updated_at = created_at WHERE updated_at IS NULL;

-- Set NOT NULL constraint and default value for future records
ALTER TABLE invitations ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE invitations ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add trigger for automatically updating updated_at
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON invitations
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON COLUMN invitations.updated_at IS 'Last time the invitation was updated'; 