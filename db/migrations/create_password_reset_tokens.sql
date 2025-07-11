-- Create password_reset_tokens table for handling password reset functionality
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_status ON password_reset_tokens(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Create trigger for automatically updating updated_at
CREATE TRIGGER update_password_reset_tokens_updated_at
BEFORE UPDATE ON password_reset_tokens
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Enable RLS on the table
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only view their own password reset tokens
CREATE POLICY "Users can view their own password reset tokens" ON password_reset_tokens
FOR SELECT
USING (email = auth.email());

-- Only service role can insert/update/delete password reset tokens
CREATE POLICY "Service role can manage password reset tokens" ON password_reset_tokens
FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for secure password reset functionality';
COMMENT ON COLUMN password_reset_tokens.email IS 'Email address of the user requesting password reset';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique token for password reset verification';
COMMENT ON COLUMN password_reset_tokens.status IS 'Status of the token: pending, used, or expired';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'When the token expires';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'When the token was used to reset password'; 