-- FIX FOR CHAT MESSAGES UPDATE POLICY
-- This script fixes the RLS policy issue that prevents users from marking messages as read

-- Step 1: Modify the update policy for chat_messages to allow updating is_read
DROP POLICY IF EXISTS "Users can update only their messages" ON chat_messages;

-- Create two separate policies:
-- 1. Policy for updating your own messages (no restrictions)
CREATE POLICY "Users can update their own messages" ON chat_messages
FOR UPDATE
USING (user_id = auth.uid());

-- 2. Policy for updating is_read on other people's messages in your chats
CREATE POLICY "Users can mark messages as read in their chats" ON chat_messages
FOR UPDATE
USING (
    -- Message is in a chat the user participates in
    chat_id IN (
        SELECT id FROM chats WHERE 
            user_id = auth.uid() OR  -- User's own chat
            (
                SELECT created_by FROM proposals WHERE id = proposal_id
            ) = auth.uid()  -- Admin of the proposal
    )
)
WITH CHECK (
    -- Only allow updating the is_read field to true
    is_read = true
);

-- Add comments explaining the policies
COMMENT ON POLICY "Users can update their own messages" ON chat_messages IS 
'Allow users to update any field in their own messages';

COMMENT ON POLICY "Users can mark messages as read in their chats" ON chat_messages IS 
'Allow users to mark any message as read in their chats'; 