# Supabase Database Setup

This directory contains SQL migration files for setting up the database schema in your Supabase project.

## Schema Overview

The database schema includes:

- **Users**: Authentication with two roles (admin, user)
- **Proposals**: Created by admins
- **Responses**: User responses to proposals
- **Admin Responses**: Admin reviews of user responses
- **Notifications**: System for notifying users about various events

## How to Use

### Option 1: Using the SQL Editor in Supabase Dashboard

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `migrations/init.sql`
5. Run the query

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed, you can run:

```bash
supabase db reset
```

Or for migrations:

```bash
supabase migration up
```

## Security Features

The schema includes:

- Row Level Security (RLS) policies to control access to data
- Automatic timestamps for created_at and updated_at fields
- Constraint checks for valid date ranges
- Unique constraints to prevent duplicate records
- Trigger functions for automatic notifications

## Database Entities

### Users Table
- Contains all users with a role field to distinguish between admins and regular users
- All users share this single table

### Proposals Table
- Stores campaign proposals created by admins
- Includes rich content as JSONB
- References the creating admin

### Responses Table
- Stores user responses to proposals
- Limited to one response per user per proposal
- Contains various optional fields for different response data

### Admin Responses Table
- Stores admin reviews of user responses
- Limited to one admin response per user response
- Includes approval status and messages

### Notifications Table
- Stores all system notifications
- Links to related proposals and responses when applicable
- Includes read status tracking

## Automatic Notifications

The schema includes triggers to automatically create notifications for:

1. User submits/updates a response → Admins get notified
2. Admin creates/updates a proposal → All users get notified
3. Admin replies to a user's response → User gets notified 