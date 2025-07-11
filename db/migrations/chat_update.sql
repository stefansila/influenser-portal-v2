-- Add user_id constraint if it doesn't exist
DO $$ 
BEGIN
    -- Check if user_id column exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'chats' AND column_name = 'user_id'
    ) THEN
        -- Add user_id column to chats table
        ALTER TABLE chats ADD COLUMN user_id UUID REFERENCES users(id);
        
        -- Update existing chats to associate with users based on proposal relationships
        UPDATE chats c
        SET user_id = (
            SELECT r.user_id 
            FROM responses r 
            WHERE r.proposal_id = c.proposal_id 
            LIMIT 1
        )
        WHERE c.user_id IS NULL;
        
        -- Make user_id NOT NULL after update
        ALTER TABLE chats ALTER COLUMN user_id SET NOT NULL;
        
        -- Create unique constraint
        ALTER TABLE chats ADD CONSTRAINT chats_proposal_user_unique UNIQUE(proposal_id, user_id);
    END IF;
END $$;

-- Create index for user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);

-- Drop and recreate chat policies to reflect the correct authorization
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR
    proposal_id IN (
        SELECT id FROM proposals WHERE created_by = auth.uid()
    )
);

-- Update chat messages policies
DROP POLICY IF EXISTS "Users can insert messages into their chats" ON chat_messages;
CREATE POLICY "Users can insert messages into their chats" ON chat_messages
FOR INSERT
WITH CHECK (
    chat_id IN (
        SELECT id FROM chats 
        WHERE user_id = auth.uid() OR
        proposal_id IN (
            SELECT id FROM proposals WHERE created_by = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
CREATE POLICY "Users can view messages in their chats" ON chat_messages
FOR SELECT
USING (
    chat_id IN (
        SELECT id FROM chats 
        WHERE user_id = auth.uid() OR
        proposal_id IN (
            SELECT id FROM proposals WHERE created_by = auth.uid()
        )
    )
);

-- Update trigger function to handle unique constraint
CREATE OR REPLACE FUNCTION create_chat_on_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a new chat for this specific user and proposal
    INSERT INTO chats (proposal_id, user_id)
    VALUES (NEW.proposal_id, NEW.user_id)
    ON CONFLICT (proposal_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql'; 