# Jersey Batch Order Management

A streamlined application for managing custom jersey orders, customer info, and production status.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn UI + Tailwind CSS
- **Backend**: Supabase
- **Icons**: Lucide React
- **Animations**: Framer Motion

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (Version 18 or higher)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (Optional, for local development)

### 2. Installation
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and add your Supabase credentials:
```dotenv
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 4. Database Setup
If you are setting up a new Supabase project, you can find the migrations in the `supabase/migrations` folder.

### 5. Running the App
```bash
npm run dev
```

## Features
- **Public Order Form**: Allow customers/resellers to submit orders.
- **Admin Dashboard**: Manage orders, track production, and view customer details.
- **Reseller Portal**: Dedicated space for resellers to view their own history.
- **Design Uploads**: Support for attaching design files to orders.
