-- FIX CHAT ISOLATION
-- This script ensures each user has their own individual chat for each proposal

-- 1. First validate the chats table structure
DO $$ 
BEGIN
    -- Make sure user_id column exists and has the proper constraints
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
    END IF;
    
    -- Make sure unique constraint exists
    IF NOT EXISTS (
        SELECT FROM pg_constraint
        WHERE conname = 'chats_proposal_user_unique'
    ) THEN
        -- Create unique constraint
        ALTER TABLE chats ADD CONSTRAINT chats_proposal_user_unique UNIQUE(proposal_id, user_id);
    END IF;
END $$;

-- 2. Fix any orphaned messages
CREATE TEMP TABLE orphaned_messages AS
SELECT cm.id, cm.chat_id, cm.user_id, c.proposal_id
FROM chat_messages cm
LEFT JOIN chats c ON cm.chat_id = c.id
WHERE c.id IS NULL;

-- If there are orphaned messages, move them to the correct chats
DO $$
DECLARE
  orphan_record RECORD;
  correct_chat_id UUID;
BEGIN
  FOR orphan_record IN SELECT * FROM orphaned_messages
  LOOP
    -- Find the correct chat for this message
    SELECT id INTO correct_chat_id
    FROM chats 
    WHERE proposal_id = orphan_record.proposal_id AND user_id = orphan_record.user_id;
    
    IF correct_chat_id IS NOT NULL THEN
      -- Update the message to use the correct chat
      UPDATE chat_messages
      SET chat_id = correct_chat_id
      WHERE id = orphan_record.id;
      
      RAISE NOTICE 'Fixed orphaned message % by moving to chat %', orphan_record.id, correct_chat_id;
    ELSE
      -- If no correct chat exists, create one and then move the message
      INSERT INTO chats (proposal_id, user_id)
      VALUES (orphan_record.proposal_id, orphan_record.user_id)
      RETURNING id INTO correct_chat_id;
      
      UPDATE chat_messages
      SET chat_id = correct_chat_id
      WHERE id = orphan_record.id;
      
      RAISE NOTICE 'Created new chat % for orphaned message %', correct_chat_id, orphan_record.id;
    END IF;
  END LOOP;
END $$;

-- 3. Ensure the chat_messages_with_users view exists and is correct
CREATE OR REPLACE VIEW chat_messages_with_users AS
SELECT 
  cm.id,
  cm.chat_id,
  cm.user_id,
  cm.message,
  cm.created_at,
  cm.is_read,
  cm.attachment_url,
  cm.file_name,
  u.full_name,
  u.email
FROM 
  chat_messages cm
JOIN 
  users u ON cm.user_id = u.id;

-- Grant the same permissions to the view as the original table
GRANT SELECT ON chat_messages_with_users TO authenticated;

-- 4. Ensure proper RLS policies are in place
-- First for the chats table
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR  -- User's own chat
    (
        SELECT created_by FROM proposals WHERE id = proposal_id
    ) = auth.uid()  -- Admin of the proposal
);

-- Then for the chat_messages table
DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can view only their chat messages" ON chat_messages;
CREATE POLICY "Users can view all messages in their chats" ON chat_messages
FOR SELECT
USING (
    chat_id IN (
        SELECT id FROM chats WHERE 
            user_id = auth.uid() OR  -- User's own chat
            (
                SELECT created_by FROM proposals WHERE id = proposal_id
            ) = auth.uid()  -- Admin of the proposal
    )
);

DROP POLICY IF EXISTS "Users can insert messages into their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert only into their chats" ON chat_messages;
CREATE POLICY "Users can insert messages into their chats" ON chat_messages
FOR INSERT
WITH CHECK (
    chat_id IN (
        SELECT id FROM chats WHERE 
            user_id = auth.uid() OR  -- User's own chat
            (
                SELECT created_by FROM proposals WHERE id = proposal_id
            ) = auth.uid()  -- Admin of the proposal
    )
);

-- 5. Remove attempt to enable RLS on view (not supported)
-- Note: Security is handled by RLS on the underlying tables instead
DROP POLICY IF EXISTS "Users can view only their chat messages in view" ON chat_messages_with_users;

-- 6. Create or update the trigger to ensure each user gets their own chat
CREATE OR REPLACE FUNCTION create_chat_on_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a chat for this specific user-proposal combination
    INSERT INTO chats (proposal_id, user_id)
    VALUES (NEW.proposal_id, NEW.user_id)
    ON CONFLICT (proposal_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS create_chat_after_response ON responses;
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response();

-- 7. Clean up temp tables
DROP TABLE IF EXISTS orphaned_messages; 