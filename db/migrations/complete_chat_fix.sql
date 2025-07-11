-- FULL CHAT SYSTEM FIX
-- This script completely rebuilds the chat system to ensure proper user isolation

-- Create backup tables
CREATE TABLE IF NOT EXISTS chats_backup AS SELECT * FROM chats;
CREATE TABLE IF NOT EXISTS chat_messages_backup AS SELECT * FROM chat_messages;

-- Step 1: Add a cascade option to the foreign key constraint to ensure messages are deleted if a chat is deleted
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_chat_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_chat_id_fkey 
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

-- Step 2: Drop all existing related objects
DROP TRIGGER IF EXISTS create_chat_after_response ON responses;
DROP FUNCTION IF EXISTS create_chat_on_response();

DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages into their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can update messages in their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;

-- Step 3: Delete all existing chats and messages (we have backups)
-- Use CASCADE to avoid foreign key constraint errors
TRUNCATE chat_messages;
TRUNCATE chats CASCADE;

-- Step 4: Get proposal and user data
CREATE TEMP TABLE proposal_users AS 
SELECT DISTINCT r.proposal_id, r.user_id, p.created_by AS admin_id
FROM responses r
JOIN proposals p ON r.proposal_id = p.id
WHERE r.user_id != p.created_by;

-- Step 5: Create individual chats for each user-proposal combination
INSERT INTO chats (id, proposal_id, user_id, created_at)
SELECT 
    uuid_generate_v4(),
    pu.proposal_id,
    pu.user_id,
    NOW()
FROM proposal_users pu;

-- Step 6: Map old chats to new chats
CREATE TEMP TABLE chat_mapping AS
WITH old_chats AS (
    SELECT 
        cb.id AS old_chat_id,
        cb.proposal_id,
        cm.user_id AS message_sender_id,
        p.created_by AS admin_id
    FROM chats_backup cb
    JOIN chat_messages_backup cm ON cm.chat_id = cb.id
    JOIN proposals p ON cb.proposal_id = p.id
    WHERE cm.user_id != p.created_by
    GROUP BY cb.id, cb.proposal_id, cm.user_id, p.created_by
)
SELECT 
    oc.old_chat_id,
    oc.proposal_id,
    oc.message_sender_id,
    oc.admin_id,
    nc.id AS new_chat_id
FROM old_chats oc
JOIN chats nc ON nc.proposal_id = oc.proposal_id AND nc.user_id = oc.message_sender_id;

-- Step 7: Migrate messages to the correct chats
-- First, admin messages
INSERT INTO chat_messages (id, chat_id, user_id, message, created_at, is_read)
SELECT 
    uuid_generate_v4(),
    cm.new_chat_id,
    mb.user_id,
    mb.message,
    mb.created_at,
    mb.is_read
FROM chat_messages_backup mb
JOIN chat_mapping cm ON mb.chat_id = cm.old_chat_id
WHERE mb.user_id = cm.admin_id;

-- Then, user messages to their own chats
INSERT INTO chat_messages (id, chat_id, user_id, message, created_at, is_read)
SELECT 
    uuid_generate_v4(),
    cm.new_chat_id,
    mb.user_id,
    mb.message,
    mb.created_at,
    mb.is_read
FROM chat_messages_backup mb
JOIN chat_mapping cm ON mb.chat_id = cm.old_chat_id
WHERE mb.user_id = cm.message_sender_id AND mb.user_id != cm.admin_id;

-- Step 8: Create RLS policies with multiple safeguards
-- First policy: Users can only select their own chats
CREATE POLICY "Users can view their own chats only" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR  -- User's own chat
    (
        SELECT created_by FROM proposals WHERE id = proposal_id
    ) = auth.uid()  -- Admin of the proposal
);

-- Second policy: Users can only select messages from their own chats
CREATE POLICY "Users can view only their chat messages" ON chat_messages
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

-- Third policy: Users can only insert messages into their own chats
CREATE POLICY "Users can insert only into their chats" ON chat_messages
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

-- Fourth policy: Users can only update messages they own
CREATE POLICY "Users can update only their messages" ON chat_messages
FOR UPDATE
USING (
    user_id = auth.uid() -- Only messages they created
);

-- Step 9: Create a new chat creation trigger function
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

-- Step 10: Create the trigger
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response();

-- Step 11: Add additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_is_read ON chat_messages(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chats_user_proposal ON chats(user_id, proposal_id);

-- Step 12: Clean up
DROP TABLE chat_mapping;
DROP TABLE proposal_users; 