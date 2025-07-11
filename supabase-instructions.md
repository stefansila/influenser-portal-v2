# Setting up the Rich Text Bucket in Supabase

We were unable to automatically create the Supabase bucket due to permission issues. Follow these steps to create it manually:

## Create the 'rich-text' Bucket

1. Log in to your Supabase dashboard at https://app.supabase.com
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Enter **rich-text** as the bucket name
5. Check **Public bucket** to make the files publicly accessible
6. Click **Create bucket**

## Set up Access Policies

After creating the bucket, you need to set up access policies:

1. Click on the newly created **rich-text** bucket
2. Go to the **Policies** tab
3. Create the following policies:

### Upload Policy (INSERT)
- Policy name: `Allow authenticated uploads`
- Allowed operation: `INSERT`
- Policy definition: `auth.role() = 'authenticated'`

### View Policy (SELECT)
- Policy name: `Allow public access`
- Allowed operation: `SELECT`
- Policy definition: `true`

## Test Your Setup

After setting up the bucket and policies:

1. Restart your Next.js development server
2. Navigate to the admin/create-proposal page
3. Try creating a proposal with images in the rich text editor

The rich text editor should now be working properly, and images should be uploaded to your Supabase storage bucket instead of being stored as base64 in your database.

## Troubleshooting

If you still encounter issues:

1. Check browser console for errors
2. Verify that the bucket name in your code matches exactly: `rich-text`
3. Make sure your Supabase authentication is working correctly
4. Confirm that the policies are properly configured 