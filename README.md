# Allem Next.js

Advertising platform for creators built with Next.js and Supabase with simplified authentication.

## Simple Authentication System

This application uses a **simplified authentication approach** that relies on Supabase's built-in capabilities and Row Level Security (RLS) for maximum security and simplicity.

### Key Features

- **RLS-based Authorization**: All data access is controlled by Row Level Security policies in the database
- **Simple Session Management**: Uses Supabase's built-in session handling
- **No Complex Middleware**: Minimal middleware for basic routing only
- **Clean Auth Context**: Straightforward authentication state management

### How It Works

1. **Authentication**: Simple login/logout using Supabase Auth
2. **Authorization**: RLS policies in the database control data access automatically
3. **Session Management**: Supabase handles session persistence and refresh
4. **Role-based Access**: Client-side redirects based on user role from database

### Database Security

All data access is secured through RLS policies:

- **proposals**: Users can only see proposals they have access to (via `proposal_visibility` table)
- **responses**: Users can only see their own responses, admins see all
- **chat_messages**: Users can only see messages in their own chats
- **users**: Public profile data, users can only update their own profile

### Technologies

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Supabase (Authentication & Database with RLS)

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. Run the development server: `npm run dev`

### Authentication Flow

1. User visits any protected route
2. Middleware checks for active session
3. If no session → redirect to login
4. If session exists → continue to route
5. Client-side AuthContext manages user state
6. Database queries are automatically filtered by RLS policies

### Benefits of This Approach

- **Security**: RLS ensures data access is controlled at the database level
- **Simplicity**: No complex session management or middleware
- **Performance**: Minimal overhead, fast redirects
- **Maintainability**: Clean, easy-to-understand code
- **Scalability**: Supabase handles all the heavy lifting

### Page Structure

- `/login` - Login page
- `/dashboard` - User dashboard (protected)
- `/admin` - Admin panel (protected, admin-only)
- All other routes are protected and require authentication

The system automatically redirects users to the appropriate section based on their role stored in the database. 