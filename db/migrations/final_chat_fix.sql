-- FINAL CHAT FIX
-- This script fixes all known issues with the chat system

-- 1. First ensure the view exists and is correct
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

-- Grant permissions to view
GRANT SELECT ON chat_messages_with_users TO authenticated;

-- 2. Fix individual chats for each user-proposal combination
-- Get all proposals and their responses
CREATE TEMP TABLE proposal_users AS 
SELECT DISTINCT r.proposal_id, r.user_id, p.created_by AS admin_id
FROM responses r
JOIN proposals p ON r.proposal_id = p.id
WHERE r.user_id != p.created_by;

-- Insert new chats for any missing combinations
INSERT INTO chats (proposal_id, user_id)
SELECT 
    pu.proposal_id,
    pu.user_id
FROM proposal_users pu
ON CONFLICT (proposal_id, user_id) DO NOTHING;

-- 3. Check for any messages with incorrect chat_id
CREATE TEMP TABLE message_fixes AS
WITH user_chats AS (
    SELECT id, proposal_id, user_id
    FROM chats
),
message_analysis AS (
    SELECT 
        cm.id AS message_id,
        cm.chat_id AS current_chat_id,
        cm.user_id AS sender_id,
        c.proposal_id,
        CASE WHEN cm.user_id = p.created_by THEN true ELSE false END AS is_admin_message,
        uc.id AS correct_chat_id
    FROM chat_messages cm
    JOIN chats c ON cm.chat_id = c.id
    JOIN proposals p ON c.proposal_id = p.id
    LEFT JOIN user_chats uc ON 
        uc.proposal_id = c.proposal_id AND
        (
            -- For regular users, match their own chat
            (cm.user_id != p.created_by AND uc.user_id = cm.user_id) OR
            -- For admin messages, keep them in all user chats
            (cm.user_id = p.created_by AND uc.user_id = c.user_id)
        )
    WHERE 
        -- Check if the message is in the wrong chat
        (cm.user_id != p.created_by AND c.user_id != cm.user_id) OR
        -- Admin messages might need duplication to other user chats
        (cm.user_id = p.created_by AND NOT EXISTS (
            SELECT 1 FROM chat_messages cm2
            WHERE cm2.message = cm.message 
            AND cm2.user_id = cm.user_id 
            AND cm2.created_at = cm.created_at
            AND cm2.chat_id = uc.id
        ))
)
SELECT * FROM message_analysis
WHERE correct_chat_id IS NOT NULL;

-- Fix messages with incorrect chat_id
DO $$
DECLARE
    fix_record RECORD;
BEGIN
    FOR fix_record IN SELECT * FROM message_fixes
    LOOP
        IF fix_record.is_admin_message THEN
            -- For admin messages, create a copy in the correct chat
            INSERT INTO chat_messages (id, chat_id, user_id, message, created_at, is_read)
            VALUES (
                uuid_generate_v4(),
                fix_record.correct_chat_id,
                fix_record.sender_id,
                (SELECT message FROM chat_messages WHERE id = fix_record.message_id),
                (SELECT created_at FROM chat_messages WHERE id = fix_record.message_id),
                (SELECT is_read FROM chat_messages WHERE id = fix_record.message_id)
            );
        ELSE
            -- For user messages, move them to the correct chat
            UPDATE chat_messages
            SET chat_id = fix_record.correct_chat_id
            WHERE id = fix_record.message_id;
        END IF;
    END LOOP;
END $$;

-- 4. Ensure chat_messages has required foreign keys
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_chat_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_chat_id_fkey 
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

-- 5. Create proper RLS policies
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view their own chats only" ON chats;
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR  -- User's own chat
    (
        SELECT created_by FROM proposals WHERE id = proposal_id
    ) = auth.uid()  -- Admin of the proposal
);

-- 6. Update chat message policies
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

-- 7. Create RLS policy for the view
ALTER VIEW chat_messages_with_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view only their chat messages in view" ON chat_messages_with_users;
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

-- 8. Recreate indexes for performance
DROP INDEX IF EXISTS idx_chat_messages_chat_id;
DROP INDEX IF EXISTS idx_chat_messages_user_id;
DROP INDEX IF EXISTS idx_chat_messages_is_read;
DROP INDEX IF EXISTS idx_chat_messages_user_is_read;
DROP INDEX IF EXISTS idx_chats_user_proposal;

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX idx_chat_messages_user_is_read ON chat_messages(user_id, is_read);
CREATE INDEX idx_chats_user_proposal ON chats(user_id, proposal_id);

-- 9. Update the chat creation trigger
CREATE OR REPLACE FUNCTION create_chat_on_response()
RETURNS TRIGGER AS $$
DECLARE
    proposal_admin_id UUID;
BEGIN
    -- Get the admin ID for this proposal
    SELECT created_by INTO proposal_admin_id
    FROM proposals 
    WHERE id = NEW.proposal_id;
    
    -- Only create a chat if user is not the admin
    IF NEW.user_id != proposal_admin_id THEN
        -- Create a chat for this user and proposal
        INSERT INTO chats (proposal_id, user_id)
        VALUES (NEW.proposal_id, NEW.user_id)
        ON CONFLICT (proposal_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS create_chat_after_response ON responses;
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response();

-- 10. Clean up
DROP TABLE IF EXISTS message_fixes;
DROP TABLE IF EXISTS proposal_users; 