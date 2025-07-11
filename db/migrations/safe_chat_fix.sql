-- SAFE CHAT SYSTEM FIX
-- This script fixes the chat system without truncating tables

-- Create backup tables
CREATE TABLE IF NOT EXISTS chats_backup AS SELECT * FROM chats;
CREATE TABLE IF NOT EXISTS chat_messages_backup AS SELECT * FROM chat_messages;

-- Step 1: Drop existing policies and triggers
DROP TRIGGER IF EXISTS create_chat_after_response ON responses;
DROP FUNCTION IF EXISTS create_chat_on_response();

DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages into their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can update messages in their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;

-- Step 2: Create proper chats for each user
-- Get all proposals and their responses
CREATE TEMP TABLE proposal_users AS 
SELECT DISTINCT r.proposal_id, r.user_id, p.created_by AS admin_id
FROM responses r
JOIN proposals p ON r.proposal_id = p.id
WHERE r.user_id != p.created_by;

-- Insert new chats where needed (using ON CONFLICT to avoid duplicates)
INSERT INTO chats (proposal_id, user_id)
SELECT 
    pu.proposal_id,
    pu.user_id
FROM proposal_users pu
ON CONFLICT (proposal_id, user_id) DO NOTHING;

-- Step 3: Create RLS policies with multiple safeguards
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

-- Step 4: Reorganize messages
-- First, identify message senders and chats
CREATE TEMP TABLE message_mapping AS
WITH message_participants AS (
    SELECT 
        cm.id AS message_id,
        cm.chat_id AS old_chat_id,
        cm.user_id AS sender_id,
        c.proposal_id,
        CASE WHEN cm.user_id = p.created_by THEN true ELSE false END AS is_admin_message
    FROM chat_messages_backup cm
    JOIN chats_backup c ON cm.chat_id = c.id
    JOIN proposals p ON c.proposal_id = p.id
)
SELECT 
    mp.message_id,
    mp.old_chat_id,
    mp.sender_id,
    mp.proposal_id,
    mp.is_admin_message,
    nc.id AS new_chat_id
FROM message_participants mp
JOIN chats nc ON 
    nc.proposal_id = mp.proposal_id AND 
    (
        -- For admin messages, join with the target user's chat
        (mp.is_admin_message = true AND nc.user_id != mp.sender_id) OR
        -- For user messages, join with their own chat
        (mp.is_admin_message = false AND nc.user_id = mp.sender_id)
    );

-- Create new/corrected messages
CREATE TABLE chat_messages_new (LIKE chat_messages INCLUDING ALL);

-- Copy all existing messages that aren't part of shared chats
INSERT INTO chat_messages_new
SELECT * FROM chat_messages cm
WHERE NOT EXISTS (
    SELECT 1 
    FROM message_mapping mm 
    WHERE mm.message_id = cm.id
);

-- Insert corrected messages from the mapping
INSERT INTO chat_messages_new (id, chat_id, user_id, message, created_at, is_read)
SELECT 
    uuid_generate_v4(),  -- Generate new ID to avoid conflicts
    mm.new_chat_id,
    cm.user_id,
    cm.message,
    cm.created_at,
    cm.is_read
FROM chat_messages_backup cm
JOIN message_mapping mm ON cm.id = mm.message_id;

-- Replace the old table with the corrected one
DROP TABLE chat_messages;
ALTER TABLE chat_messages_new RENAME TO chat_messages;

-- Step 5: Add foreign key constraint and indexes
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_chat_id_fkey 
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_user_is_read ON chat_messages(user_id, is_read);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX idx_chats_user_proposal ON chats(user_id, proposal_id);

-- Step 6: Create a new chat creation trigger function
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

-- Step 7: Create the trigger
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response();

-- Step 8: Clean up
DROP TABLE IF EXISTS message_mapping;
DROP TABLE IF EXISTS proposal_users; 