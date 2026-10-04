# NeoLibrary — Digital Library Management System

NeoLibrary is a premium, state-of-the-art Digital Library Management System built with modern web aesthetics, responsive glassmorphic UI, Express.js backend, and Supabase database integration.

---

## 🌟 Key Features

- **Modern Glassmorphic Dark UI**: Vibrant HSL color palette, typography (Outfit, Inter, JetBrains Mono), responsive mobile drawer navigation, smooth micro-animations.
- **Patron Portal**: Interactive catalog search, genre filters, active loan tracking, reservation queue management, fine alerts, community book reviews, and patron profile settings.
- **Staff & Admin Management Matrix**:
  - **Book Inventory Matrix**: CRUD book operations, cover image upload, stock control, and soft archiving.
  - **User & Patron Matrix**: Staff role clearances (`admin`, `librarian`, `patron`), account suspension, and borrowing history audit.
  - **System Analytics**: Real-time popular book metrics, overdue loan audit, daily borrowing trends, and instant CSV log exports.
  - **Policy Engine**: Global loan duration, max copy allowance per patron, daily fine rate calculation, and database seed maintenance.
- **Database Support**: Built-in support for real Supabase PostgreSQL DB and instant offline Mock Mode for development/testing.

---

## 🚀 Deployment Instructions (Render.com)

### 1. Environment Variables
Set the following environment variables in your Render Web Service dashboard:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Deployment mode |
| `PORT` | `3000` | Port for Express server |
| `SERVE_STATIC` | `true` | Enables static frontend serving |
| `MOCK_MODE` | `false` | Enables real Supabase database connection |
| `SUPABASE_URL` | `https://your-supabase-url.supabase.co` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `your-supabase-anon-key` | Your Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-supabase-service-role-key` | Your Supabase service key |
| `JWT_SECRET` | `your-jwt-secret-string` | Custom JWT secret key |

### 2. Render Web Service Settings
- **Root Directory**: `backend` (or leave empty if using root `package.json`)
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

---

## 📊 Database Setup (Supabase)

1. Log in to [Supabase Dashboard](https://supabase.com/).
2. Create a new project.
3. Open the **SQL Editor** tab.
4. Copy the SQL script from `backend/database/schema.sql` and run it in the SQL Editor.
5. Copy your **Project URL**, **Anon Key**, and **Service Role Key** into your environment configuration.

---

## 💻 Local Development

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Start the server:
   ```bash
   node server.js
   ```
3. Open your browser at `http://localhost:3000`.

---

## 📄 License
MIT License. Built for digital library management.
