-- FIX FOR CHAT MESSAGES
-- This script fixes the foreign key relationship issues and message display problems

-- Step 1: Add the missing foreign key to users in chat_messages table
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id);

-- Step 2: Check if any messages need to be corrected
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
    END IF;
  END LOOP;
END $$;

-- Step 3: Fix the query used by the frontend by adding a view
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

-- Step 4: Create RLS policy for the view
ALTER TABLE chat_messages_with_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view only their chat messages in view" ON chat_messages_with_users
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

-- Step 5: Fix the indexes to improve performance
DROP INDEX IF EXISTS idx_chat_messages_user_is_read;
DROP INDEX IF EXISTS idx_chat_messages_chat_id;
DROP INDEX IF EXISTS idx_chat_messages_user_id;
DROP INDEX IF EXISTS idx_chat_messages_is_read;

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX idx_chat_messages_user_is_read ON chat_messages(user_id, is_read);

-- Step 6: Update the message validation policy to ensure messages stay visible
DROP POLICY IF EXISTS "Users can view only their chat messages" ON chat_messages;
CREATE POLICY "Users can view only their chat messages" ON chat_messages
FOR SELECT
USING (
    user_id = auth.uid() OR  -- User's own messages
    chat_id IN (
        SELECT id FROM chats WHERE 
            user_id = auth.uid() OR  -- User's own chat
            (
                SELECT created_by FROM proposals WHERE id = proposal_id
            ) = auth.uid()  -- Admin of the proposal
    )
);

-- Step 7: Clean up
DROP TABLE IF EXISTS orphaned_messages; 