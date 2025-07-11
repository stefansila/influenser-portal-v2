-- Add attachment fields to chat_messages table if they don't exist
DO $$ 
BEGIN
    -- Add attachment_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'attachment_url'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN attachment_url TEXT;
    END IF;
    
    -- Add file_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'file_name'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN file_name TEXT;
    END IF;
END $$;

-- Update the chat_messages_with_users view to include attachment fields
DROP VIEW IF EXISTS chat_messages_with_users;

CREATE VIEW chat_messages_with_users AS
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

-- Create storage bucket for chat attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat', 'chat', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for chat bucket
DO $$
BEGIN
    -- Policy for authenticated users to upload files
    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'chat' 
        AND name = 'Users can upload chat files'
    ) THEN
        CREATE POLICY "Users can upload chat files" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'chat' AND
            auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
    
    -- Policy for authenticated users to view files
    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'chat' 
        AND name = 'Users can view chat files'
    ) THEN
        CREATE POLICY "Users can view chat files" ON storage.objects
        FOR SELECT USING (bucket_id = 'chat');
    END IF;
    
    -- Policy for authenticated users to delete their own files
    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'chat' 
        AND name = 'Users can delete their own chat files'
    ) THEN
        CREATE POLICY "Users can delete their own chat files" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'chat' AND
            auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END $$; 