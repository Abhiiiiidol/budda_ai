# Budda — Technical Specification for Production Build

> **What is this file?** This is the complete technical blueprint for building Budda — a Product Memory Agent for product managers. Feed this entire file to Claude Code and it will know exactly what to build, in what order, and how every piece connects.

---

## 1. Product Summary

Budda is a web application where product managers can:
- Create separate workspaces for each product they manage
- Feed documents (PDF, DOCX, images), links (Figma, YouTube, websites), AI chat exports (ChatGPT, Claude, Perplexity), and Google Drive files into each workspace
- Every entry has a "context note" — a human explanation of why it matters
- Ask questions in natural language and get answers pulled only from their fed documents
- Get original document links returned with every answer
- See what changed in documents since last sync
- Search and filter across all entries by type, source, or keyword

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 14+ | Frontend + API routes |
| Language | TypeScript | 5+ | Type safety |
| Styling | Tailwind CSS | 3+ | UI styling |
| UI Components | shadcn/ui | latest | Pre-built accessible components |
| Database | Supabase (PostgreSQL) | latest | Data storage, file storage, vector search |
| ORM | Drizzle ORM | latest | Type-safe database queries |
| Vector Search | pgvector (Supabase extension) | latest | Semantic document search |
| AI | Google Gemini API | gemini-2.0-flash | Text extraction, Q&A, embeddings |
| Embeddings | Gemini Embedding API | text-embedding-004 | Document vectorization |
| File Storage | Supabase Storage | latest | PDF, image, document uploads |
| Google Drive | Google Drive API v3 | v3 | Read Drive documents |
| Auth | Better Auth | latest | Google OAuth + email login |
| Hosting | Vercel | latest | Deployment |
| Package Manager | Bun | latest | Dependencies |

---

## 3. Project Structure

```
budda/
├── app/
│   ├── layout.tsx                  # Root layout with providers
│   ├── page.tsx                    # Landing/marketing page
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page
│   │   └── signup/page.tsx         # Signup page
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Dashboard layout with sidebar
│   │   ├── products/
│   │   │   ├── page.tsx            # All products grid (home)
│   │   │   └── [productId]/
│   │   │       ├── page.tsx        # Product detail — entries view
│   │   │       ├── feed/page.tsx   # Feed Budda interface
│   │   │       └── ask/page.tsx    # Ask Budda chat interface
│   │   └── settings/page.tsx       # User settings, Google Drive connect
│   └── api/
│       ├── ai/
│       │   ├── ask/route.ts        # Ask Budda — Q&A endpoint
│       │   ├── extract/route.ts    # Extract text from uploaded files
│       │   └── embed/route.ts      # Generate embeddings for entries
│       ├── entries/
│       │   ├── route.ts            # CRUD for entries
│       │   └── search/route.ts     # Semantic search endpoint
│       ├── products/
│       │   └── route.ts            # CRUD for products
│       ├── drive/
│       │   └── read/route.ts       # Read Google Drive documents
│       └── webhooks/
│           └── drive/route.ts      # Google Drive change notifications (future)
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── products/
│   │   ├── product-card.tsx
│   │   ├── product-grid.tsx
│   │   └── create-product-dialog.tsx
│   ├── entries/
│   │   ├── entry-row.tsx
│   │   ├── entry-list.tsx
│   │   ├── entry-filters.tsx
│   │   └── entry-detail.tsx
│   ├── feed/
│   │   ├── feed-panel.tsx          # Main feed interface
│   │   ├── document-upload.tsx     # PDF/doc upload mode
│   │   ├── link-input.tsx          # Link paste mode
│   │   ├── ai-chat-input.tsx       # AI chat export mode
│   │   ├── image-upload.tsx        # Image upload mode
│   │   └── drive-input.tsx         # Google Drive link mode
│   ├── ask/
│   │   ├── chat-interface.tsx
│   │   ├── chat-message.tsx
│   │   └── suggested-prompts.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── nav.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts                # Drizzle client instance (connects to Supabase Postgres)
│   │   ├── schema.ts               # Drizzle table definitions (profiles, products, entries, chat_messages)
│   │   └── queries.ts              # Reusable query functions
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client (auth + storage only)
│   │   ├── server.ts               # Server Supabase client (auth + storage only)
│   │   └── middleware.ts            # Auth middleware
│   ├── gemini/
│   │   ├── client.ts               # Gemini API client
│   │   ├── extract.ts              # Text extraction logic
│   │   ├── embed.ts                # Embedding generation
│   │   └── ask.ts                  # Q&A logic with context building
│   ├── drive/
│   │   └── client.ts               # Google Drive API client
│   ├── utils/
│   │   ├── detect-link.ts          # Auto-detect link type (Figma, YouTube, etc.)
│   │   ├── constants.ts            # Types, sources, icons mapping
│   │   └── helpers.ts              # General utilities
│   └── types/
│       └── index.ts                # TypeScript type definitions
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
├── public/
│   └── logo.svg
├── .env.local                      # Environment variables
├── drizzle.config.ts               # Drizzle ORM configuration
├── middleware.ts                    # Next.js middleware for auth
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Database Schema

### Enable Extensions (run first in Supabase SQL editor)

```sql
create extension if not exists vector with schema extensions;
```

### Tables

```sql
-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  google_drive_token jsonb,         -- stored OAuth token for Drive
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================
-- PRODUCTS
-- ============================================
create table public.products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '🧘',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products enable row level security;

create policy "Users can CRUD own products"
  on public.products for all using (auth.uid() = user_id);

create index idx_products_user on public.products(user_id);


-- ============================================
-- ENTRIES (the core memory unit)
-- ============================================
create table public.entries (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Content
  title text not null,
  content text,                          -- extracted/pasted text content
  context text,                          -- human-written context note (WHY it matters)
  
  -- Classification
  entry_type text not null default 'Other',
    -- Values: PRD, Research, Design, Tech Spec, Change Log, AI Chat, Link, Image, Meeting Notes, Spec, Other
  source text not null default 'Manual',
    -- Values: Manual, Figma, ChatGPT, Claude, Perplexity, YouTube, Google Drive, Website, Image

  -- Links & Files
  link text,                             -- original URL (Figma, YouTube, Drive, etc.)
  file_path text,                        -- Supabase Storage path for uploaded files
  file_name text,                        -- original file name
  file_type text,                        -- mime type

  -- Change tracking
  content_hash text,                     -- hash of content for change detection
  previous_content_hash text,            -- hash from last sync (for diff)
  has_changes boolean default false,     -- flagged when content differs from previous

  -- Vector embedding for semantic search
  embedding vector(768),                 -- Gemini text-embedding-004 outputs 768 dimensions

  -- Metadata
  status text default 'Active',          -- Active, Archived
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.entries enable row level security;

create policy "Users can CRUD own entries"
  on public.entries for all using (auth.uid() = user_id);

create index idx_entries_product on public.entries(product_id);
create index idx_entries_user on public.entries(user_id);
create index idx_entries_type on public.entries(entry_type);
create index idx_entries_source on public.entries(source);

-- Vector similarity search index
create index idx_entries_embedding on public.entries
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);


-- ============================================
-- CHAT HISTORY (Ask Budda conversations)
-- ============================================
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null,                    -- 'user' or 'assistant'
  content text not null,
  referenced_entry_ids uuid[],           -- which entries were used to answer
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can CRUD own chat messages"
  on public.chat_messages for all using (auth.uid() = user_id);

create index idx_chat_product on public.chat_messages(product_id);


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Semantic search function
create or replace function match_entries(
  query_embedding vector(768),
  match_product_id uuid,
  match_count int default 10,
  match_threshold float default 0.3
)
returns table (
  id uuid,
  title text,
  content text,
  context text,
  entry_type text,
  source text,
  link text,
  similarity float
)
language sql stable
as $$
  select
    entries.id,
    entries.title,
    entries.content,
    entries.context,
    entries.entry_type,
    entries.source,
    entries.link,
    1 - (entries.embedding <=> query_embedding) as similarity
  from public.entries
  where entries.product_id = match_product_id
    and entries.embedding is not null
    and 1 - (entries.embedding <=> query_embedding) > match_threshold
  order by entries.embedding <=> query_embedding
  limit match_count;
$$;
```

### Supabase Storage Buckets

Create these buckets in Supabase dashboard:

```
documents    — for PDFs, DOCX, XLSX, PPTX uploads (private)
images       — for screenshots, wireframes, photos (private)
```

Both buckets should have RLS policies so users can only access their own files.

### Drizzle ORM Configuration

**Important: Supabase is used for Auth and Storage only. All database queries go through Drizzle ORM connecting directly to the Supabase Postgres database.**

**drizzle.config.ts:**
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**lib/db/schema.ts:**
```typescript
import { pgTable, uuid, text, timestamp, boolean, jsonb, vector } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  googleDriveToken: jsonb('google_drive_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('🧘'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const entries = pgTable('entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  context: text('context'),
  entryType: text('entry_type').notNull().default('Other'),
  source: text('source').notNull().default('Manual'),
  link: text('link'),
  filePath: text('file_path'),
  fileName: text('file_name'),
  fileType: text('file_type'),
  contentHash: text('content_hash'),
  previousContentHash: text('previous_content_hash'),
  hasChanges: boolean('has_changes').default(false),
  embedding: vector('embedding', { dimensions: 768 }),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  referencedEntryIds: uuid('referenced_entry_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

**lib/db/index.ts:**
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

**Usage pattern in API routes:**
```typescript
import { db } from '@/lib/db';
import { products, entries } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// Get all products for a user
const userProducts = await db.select().from(products)
  .where(eq(products.userId, userId))
  .orderBy(desc(products.createdAt));

// Create an entry
const [newEntry] = await db.insert(entries).values({
  productId, userId, title, content, context, entryType, source, link
}).returning();

// Semantic search still uses the Supabase RPC function via supabase client
// because pgvector similarity search with Drizzle requires raw SQL
```

**Dependencies to install:**
```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

---

## 5. Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Drizzle ORM — direct Postgres connection)
# Find this in Supabase → Settings → Database → Connection string → URI
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Google Drive OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 6. Feature Specifications

### 6.1 Authentication

**Implementation:** Supabase Auth with Google OAuth and email/password.

```
Flow:
1. User lands on / (landing page)
2. Clicks "Get Started" → redirected to /login
3. Login with Google (primary) or email/password
4. On success → redirected to /products (dashboard home)
5. Middleware checks auth on all /products/* routes
6. Unauthenticated users → redirected to /login
```

Google OAuth also requests Google Drive read permissions so Budda can read their Drive files later. Scopes needed:
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

Store the Drive OAuth token in `profiles.google_drive_token` for later use.

---

### 6.2 Multi-Product Workspaces

**Page:** `/products`

**UI:** Grid of product cards. Each card shows:
- Product name
- Description (if any)
- Entry count
- Source badges (icons for which sources have been fed)
- Created date
- "New Product" button opens a dialog

**Actions:**
- Create product (name + optional description)
- Open product → navigate to `/products/[productId]`
- Delete product (with confirmation dialog)

---

### 6.3 Product Detail — Entry List

**Page:** `/products/[productId]`

**UI:** 
- Header with product name, entry count, source count
- Tab bar: All | Documents | Design | Links | AI Chats | Changes
- Search bar (filters across title, content, context, source)
- Entry list — each row shows:
  - Type icon (📋 PRD, 🔬 Research, 🎨 Design, etc.)
  - Title
  - Source badge with color (Figma purple, ChatGPT green, etc.)
  - Context note preview (one line, truncated)
  - "Open" link if entry has a URL
  - Time ago
  - Expand/collapse to see full content
  - Delete button
- "Feed Budda" button (navigates to feed page)
- "Ask Budda" button (navigates to ask page)

**Filter logic:**
- All: show everything
- Documents: entry_type IN (PRD, Tech Spec, Research, Spec, Meeting Notes)
- Design: source = 'Figma' OR entry_type = 'Design'
- Links: link IS NOT NULL
- AI Chats: source IN (ChatGPT, Claude, Perplexity)
- Changes: entry_type = 'Change Log' OR has_changes = true

---

### 6.4 Feed Budda (Smart Ingestion)

**Page:** `/products/[productId]/feed`

**UI:** A panel with 5 input mode tabs:

#### Mode 1: Document Upload
- File picker accepting: .pdf, .doc, .docx, .txt, .csv, .pptx, .xlsx
- Title field (auto-filled from filename)
- Type selector dropdown
- Context note field (with 💡 icon and placeholder: "Why does this matter?")
- Submit button

**Processing flow:**
```
1. File selected → upload to Supabase Storage (documents bucket)
2. Read file as base64
3. Send to /api/ai/extract with the base64 content
4. API sends to Gemini: "Extract all text from this document"
5. Gemini returns extracted text
6. Generate embedding via /api/ai/embed
7. Save entry to database with content, file_path, embedding
```

#### Mode 2: Link
- URL input field
- On paste → auto-detect link type (see detection logic below)
- Auto-set source and type based on detection
- Title field
- Context note field
- Content/notes textarea (optional additional notes about the link)

**Auto-detection logic:**
```typescript
function detectLink(url: string) {
  const u = url.toLowerCase();
  if (u.includes('figma.com')) return { source: 'Figma', type: 'Design' };
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { source: 'YouTube', type: 'Link' };
  if (u.includes('docs.google.com') || u.includes('drive.google.com')) return { source: 'Google Drive', type: 'Other' };
  if (u.includes('chat.openai.com') || u.includes('chatgpt.com')) return { source: 'ChatGPT', type: 'AI Chat' };
  if (u.includes('claude.ai')) return { source: 'Claude', type: 'AI Chat' };
  if (u.includes('perplexity.ai')) return { source: 'Perplexity', type: 'AI Chat' };
  if (u.includes('notion.so')) return { source: 'Website', type: 'Other' };
  return { source: 'Website', type: 'Link' };
}
```

#### Mode 3: AI Chat Export
- Source selector buttons: ChatGPT | Claude | Perplexity
- Title field
- Large textarea for pasting AI conversation/output
- Context note field ("What question were you solving? How was this used?")

#### Mode 4: Image Upload
- File picker accepting: .png, .jpg, .jpeg, .gif, .webp
- Image preview after selection
- Title field (auto-filled from filename)
- Context note field

**Processing flow:**
```
1. Image selected → upload to Supabase Storage (images bucket)
2. Read as base64
3. Send to Gemini with vision: "Describe this image in detail. Extract any text visible."
4. Save extracted description as content
5. Generate embedding
6. Save entry
```

#### Mode 5: Google Drive
- URL input field
- On paste → extract file ID from URL
- Title field (auto-filled from Drive file name)
- Context note field
- "Budda will auto-read this document" helper text

**Processing flow:**
```
1. Extract file ID from Drive URL (regex: /[-\w]{25,}/)
2. Use stored Google Drive OAuth token from user profile
3. Call Google Drive API → get file metadata (name, mimeType)
4. Call Google Drive API → export/download file content
5. If Google Doc → export as text/plain
6. If PDF → download and send to Gemini for extraction
7. If Sheet → export as CSV text
8. If PPT → export as text/plain
9. Auto-set title from file name
10. Save content + link + generate embedding
11. Store entry with source = 'Google Drive'
```

---

### 6.5 Ask Budda (AI Q&A with Semantic Search)

**Page:** `/products/[productId]/ask`

**UI:**
- Chat interface with message bubbles
- User messages on right (amber/gold background)
- Budda messages on left (with 🧘 avatar)
- Suggested prompt buttons when chat is empty:
  - "Summarize this product"
  - "Find the PRD document"
  - "What decisions changed?"
  - "What did AI tools suggest?"
  - "Show me all Figma links"
  - "Explain this to a new engineer"
- Input bar at bottom with send button
- "Budda is thinking..." loading state

**Processing flow (this is critical — the intelligence layer):**

```
When user sends a question:

1. EMBED THE QUESTION
   → Send question to Gemini Embedding API
   → Get 768-dimension vector

2. SEMANTIC SEARCH
   → Call Supabase match_entries() function
   → Pass: question embedding, product_id, top 15 results
   → Get back most relevant entries ranked by similarity

3. BUILD CONTEXT
   → Take top 15 matching entries
   → Format each as:
     "─── [TYPE] TITLE ───
      Source: SOURCE
      Date: DATE
      Original Link: LINK (if exists)
      Context: CONTEXT NOTE
      
      Content:
      FULL CONTENT"

4. SEND TO GEMINI
   → System prompt (see below)
   → Full conversation history (previous messages)
   → User's new question
   → Gemini generates answer

5. SAVE & DISPLAY
   → Save both user message and assistant message to chat_messages table
   → Display in chat interface
   → Scroll to bottom
```

**System prompt for Ask Budda:**

```
You are Budda — a product memory assistant for "{PRODUCT_NAME}" ({PRODUCT_DESCRIPTION}).

You have access to the following documents and entries for this product:

{FORMATTED ENTRIES FROM SEMANTIC SEARCH}

RULES — follow these strictly:
1. Answer ONLY from the provided documents. Never fabricate information.
2. If the answer is not in the documents, say: "I don't have that in my memory yet. Try feeding it to me!"
3. Be concise and scannable — PMs are busy. Use short paragraphs.
4. ALWAYS reference which document/entry you are pulling information from, by its title.
5. ALWAYS include original links when they exist. If an entry has a Figma link, Drive link, YouTube link, or any URL — include it in your response so the PM can access the original file.
6. When asked to "find a document" or "give me the doc about X" — search through entries, return the most relevant one with its full content and original link.
7. For change logs, clearly state what changed.
8. Flag when you are making an inference vs stating a fact from the documents.
9. Speak warmly but efficiently, like a wise assistant who knows everything about this product.
```

---

### 6.6 Document Change Tracking

**When it triggers:** Every time a Google Drive document is re-synced, or when a user re-feeds an updated document.

**Logic:**
```
1. When new content is processed, generate MD5 hash of the content
2. Compare with content_hash stored on the existing entry
3. If different:
   a. Set previous_content_hash = old content_hash
   b. Set content_hash = new hash
   c. Set has_changes = true
   d. Update content with new content
   e. Regenerate embedding
4. On the product detail page, show a banner:
   "🔄 X documents updated since last visit"
5. Changed entries show a visual indicator (amber dot or badge)
6. User can click to see the entry (full new content)
```

For MVP, we show THAT something changed. Detailed diff view (showing exactly which lines changed) is a v2 feature.

---

### 6.7 Source Awareness

Every entry is tagged with a source. The UI uses consistent colors and icons:

```typescript
const SOURCE_CONFIG = {
  'Manual':       { color: '#9CA3AF', bg: '#1F2937', icon: '✍️' },
  'Figma':        { color: '#A259FF', bg: 'rgba(162,89,255,0.12)', icon: '🎨' },
  'ChatGPT':      { color: '#10A37F', bg: 'rgba(16,163,127,0.12)', icon: '🤖' },
  'Claude':       { color: '#D97706', bg: 'rgba(217,119,6,0.12)', icon: '🧠' },
  'Perplexity':   { color: '#20B2AA', bg: 'rgba(32,178,170,0.12)', icon: '🔍' },
  'YouTube':      { color: '#FF4444', bg: 'rgba(255,68,68,0.1)', icon: '▶️' },
  'Google Drive': { color: '#4285F4', bg: 'rgba(66,133,244,0.12)', icon: '📁' },
  'Website':      { color: '#22D3EE', bg: 'rgba(34,211,238,0.1)', icon: '🌐' },
  'Image':        { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', icon: '🖼️' },
};

const TYPE_ICONS = {
  'PRD': '📋',
  'Research': '🔬',
  'Design': '🎨',
  'Tech Spec': '⚙️',
  'Change Log': '📝',
  'AI Chat': '🤖',
  'Link': '🔗',
  'Image': '🖼️',
  'Meeting Notes': '📞',
  'Spec': '📐',
  'Other': '📎',
};
```

---

## 7. API Routes

### POST /api/products
Create a new product. Body: `{ name, description? }`

### GET /api/products
List all products for the authenticated user.

### DELETE /api/products?id={id}
Delete a product and all its entries.

### POST /api/entries
Create a new entry. Body: `{ product_id, title, content, context?, entry_type, source, link?, file_path?, file_name? }`
After creating, auto-generate embedding in background.

### GET /api/entries?product_id={id}&type={type?}&source={source?}
List entries for a product with optional filters.

### DELETE /api/entries?id={id}
Delete an entry.

### POST /api/entries/search
Semantic search. Body: `{ product_id, query }`
Returns top matching entries ranked by similarity.

### POST /api/ai/extract
Extract text from uploaded file. Body: `{ base64, mimeType }`
Returns extracted text.

### POST /api/ai/embed
Generate embedding for text. Body: `{ text }`
Returns 768-dimension vector.

### POST /api/ai/ask
Ask Budda a question. Body: `{ product_id, question, history[] }`
1. Embeds question
2. Searches for relevant entries
3. Sends to Gemini with context
4. Returns answer

### POST /api/drive/read
Read a Google Drive file. Body: `{ fileUrl }`
Uses stored OAuth token to fetch and extract content.

---

## 8. Build Order (Step by Step)

Follow this exact order. Complete each step fully before moving to the next.

### Phase 1: Foundation (Day 1-2)
```
Step 1: Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
Step 2: Set up Supabase project — create tables, enable pgvector, set up RLS
Step 3: Install Drizzle ORM (drizzle-orm, postgres, drizzle-kit) — create schema.ts, db/index.ts, drizzle.config.ts
Step 4: Configure Supabase Auth with Google OAuth (Supabase client used ONLY for auth + storage)
Step 5: Create auth middleware — protect dashboard routes
Step 6: Build login/signup pages
Step 7: Create the dashboard layout (sidebar, header)
Step 8: Set up environment variables (including DATABASE_URL for Drizzle)
```

### Phase 2: Products (Day 3)
```
Step 9: Build products API route (CRUD) — use Drizzle for all DB queries
Step 10: Build products grid page with cards
Step 11: Build create product dialog
Step 12: Build delete product with confirmation
Step 13: Navigate to product detail on click
```

### Phase 3: Feed Budda (Day 4-7)
```
Step 14: Build the Gemini client (extract + embed functions)
Step 15: Set up Supabase Storage buckets (documents, images)
Step 16: Build entries API route (CRUD) — use Drizzle for all DB queries
Step 17: Build Feed Budda page with 5 mode tabs
Step 18: Implement Document Upload mode
  - File upload to Supabase Storage (use Supabase client for storage only)
  - Text extraction via Gemini
  - Embedding generation
  - Save entry via Drizzle
Step 19: Implement Link mode
  - Auto-detection logic
  - Source/type auto-fill
Step 20: Implement AI Chat mode
Step 21: Implement Image Upload mode
  - Upload to Supabase Storage
  - Vision extraction via Gemini
Step 22: Implement Google Drive mode
  - Google Drive API integration
  - File reading and content extraction
  - Auto-title from file name
Step 23: Context note field on all modes
```

### Phase 4: Browse & Filter (Day 8-9)
```
Step 24: Build entry list component with expand/collapse
Step 25: Build filter tabs (All, Documents, Design, Links, AI Chats, Changes)
Step 26: Build search bar with full-text search
Step 27: Build entry detail view (full content, context, original link button)
Step 28: Source badges with colors
Step 29: "Open original" link buttons
```

### Phase 5: Ask Budda (Day 10-12)
```
Step 30: Build semantic search API (embed question → match_entries via Supabase RPC for vector similarity, Drizzle for everything else)
Step 31: Build Ask Budda API (search → build context → Gemini Q&A)
Step 32: Build chat interface UI
Step 33: Build suggested prompts
Step 34: Implement conversation history (save to chat_messages via Drizzle)
Step 35: Ensure links are returned in answers
Step 36: Loading states ("Budda is thinking...")
```

### Phase 6: Change Tracking (Day 13)
```
Step 37: Implement content hashing on entry create/update
Step 38: Build change detection logic on re-sync
Step 39: Show "documents updated" banner on product page
Step 40: Visual indicator on changed entries
```

### Phase 7: Polish & Deploy (Day 14)
```
Step 41: Landing page (simple — logo, tagline, features, CTA)
Step 42: Loading skeletons and empty states
Step 43: Error handling on all API routes
Step 44: Mobile responsive design
Step 45: Deploy to Vercel
Step 46: Connect custom domain (optional)
```

---

## 9. Design Direction

**Aesthetic:** Dark, warm, zen-inspired. Think premium tool for busy professionals.

**Color palette:**
- Background: #07070A (near black)
- Surface: #111116 (dark card backgrounds)
- Border: #2A2A35
- Text: #EDEDED (primary), #B8B8C8 (secondary), #7A7A90 (muted)
- Accent: #F0B840 (warm amber/gold — the Budda color)
- Source colors: see SOURCE_CONFIG in section 6.7

**Typography:**
- Headings: Outfit (bold, 700-900 weight)
- Body: Outfit (regular, 400-500)
- Code/mono: JetBrains Mono
- Import: Google Fonts

**Key UI patterns:**
- Dark mode only (for MVP)
- Cards with subtle borders, hover states that highlight amber
- Amber accent for primary actions, active states, and Budda branding
- 🧘 emoji as the Budda avatar/mascot throughout
- Smooth transitions (150ms ease) on hovers and tab switches
- Entry rows are compact but expandable
- Chat bubbles: user = amber, Budda = dark surface with 🧘 icon

---

## 10. Error Handling

Every API route must handle:
- Unauthorized (no auth) → 401
- Invalid input → 400 with descriptive message
- Gemini API failure → fallback message: "Budda's thinking got interrupted. Try again."
- File upload failure → clear error with retry option
- Google Drive auth expired → prompt to re-connect Drive
- Rate limiting → queue requests, show "Budda is busy, one moment..."

---

## 11. Security

- All database tables have Row Level Security (RLS) — users can only see their own data
- File uploads validated for type and size (max 25MB)
- Google Drive tokens encrypted at rest in database
- API routes validate auth token on every request
- No sensitive data in client-side code
- Supabase service role key only used in server-side API routes, never exposed to client

---

## 12. Performance Targets

- Page load: under 2 seconds
- Entry list: render 100+ entries without lag (virtualized list if needed)
- Ask Budda response: under 8 seconds (embed + search + Gemini)
- File extraction: under 15 seconds for a 20-page PDF
- Search: under 1 second for semantic results

---

## END OF SPECIFICATION

This document contains everything needed to build Budda from scratch. Follow the build order in Section 8 step by step (46 steps, 7 phases). Each step should be completed and tested before moving to the next.

**Key architecture rule: Supabase provides the PostgreSQL database, file storage, and vector search. Drizzle ORM is the primary way to read/write data (products, entries, chat messages) — connecting directly to the Supabase PostgreSQL database via DATABASE_URL. The Supabase JS Client is used for file uploads/downloads (Storage API) and for calling the vector similarity search function (match_entries RPC). Auth is handled by Better Auth, not Supabase Auth. Package manager is Bun, not pnpm.**

  # Budda — Supplementary Technical Spec (Part 2)
  
  > **What is this file?** This is Part 2 of Budda's technical specification. Part 1 (Budda_Technical_Spec.md) contains the full feature spec, database schema, and build order. THIS file fills in the gaps — implementation details, code patterns, and corrections specific to our Better-T-Stack scaffolded project. **Read Part 1 first, then read this file.** When there's a conflict between Part 1 and this file, THIS FILE WINS.
  
  ---
  
  ## 1. Critical Corrections to Part 1
  
  ### 1.1 Auth: Use Better Auth, NOT Supabase Auth
  
  Part 1 says "Supabase Auth." **IGNORE THAT.** This project uses **Better Auth** which was set up by Better-T-Stack during scaffolding.
  
  Better Auth is already installed and configured in the project. Do NOT install Supabase Auth. Do NOT use `@supabase/supabase-js` for authentication.
  
  **What Better Auth gives us:**
  - Email/password login
  - Google OAuth (we'll configure this)
  - Session management
  - User management
  
  **Where Better Auth config lives:**
  ```
  packages/ or lib/ → look for auth.ts or better-auth config
  ```
  
  **To add Google OAuth with Better Auth:**
  
  ```typescript
  // In your Better Auth config file (find it in the scaffolded project)
  import { betterAuth } from "better-auth";
  import { drizzleAdapter } from "better-auth/adapters/drizzle";
  import { db } from "@/lib/db";
  
  export const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      },
    },
  });
  ```
  
  **Getting Google OAuth credentials (for the developer building this):**
  1. Go to https://console.cloud.google.com
  2. Create a new project called "Budda"
  3. Enable these APIs: Google Drive API, Google Identity Services
  4. Go to Credentials → Create Credentials → OAuth Client ID
  5. Application type: Web Application
  6. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (dev) and `https://yourdomain.com/api/auth/callback/google` (prod)
  7. Copy Client ID and Client Secret into `.env`
  
  **Storing the Google Drive token:**
  
  After Google OAuth login, Better Auth gives us the OAuth tokens. We need to store the Google access token and refresh token so Budda can read the user's Drive files later.
  
  ```typescript
  // After successful Google OAuth, extract and store Drive token
  // Add this to your auth callback or session handling:
  
  import { db } from "@/lib/db";
  import { profiles } from "@/lib/db/schema";
  import { eq } from "drizzle-orm";
  
  async function storeGoogleDriveToken(userId: string, tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }) {
    await db.update(profiles)
      .set({
        googleDriveToken: JSON.stringify(tokens),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));
  }
  ```
  
  ---
  
  ### 1.2 Package Manager: Bun, NOT pnpm
  
  Part 1 says pnpm. **IGNORE THAT.** This project uses **Bun**.
  
  ```bash
  # Installing packages:
  bun add <package-name>
  
  # Running dev server:
  bun run dev
  
  # Running scripts:
  bun run <script-name>
  ```
  
  ---
  
  ### 1.3 Project Structure: Adapt to Better-T-Stack
  
  Part 1 defines a project structure from scratch. **DO NOT restructure the project.** Better-T-Stack already scaffolded the project. Work WITHIN the existing structure.
  
  **Rules:**
  - Find where Better-T-Stack put the Drizzle config, schema, and db client — use those files
  - Find where Better-T-Stack put the auth config — extend it, don't replace it
  - Find the `apps/web` directory — this is your Next.js app
  - Add new files (AI client, feed logic, ask logic) inside the existing structure
  - If the existing structure has `packages/` for shared code, put the Drizzle schema and DB client there
  
  **Before writing any code, run this command and read the output:**
  ```bash
  find . -type f -name "*.ts" -o -name "*.tsx" | head -50
  ```
  This shows you the actual file structure. Adapt to it.
  
  ---
  
  ### 1.4 Supabase + Drizzle — How They Work Together
  
  **Supabase is our entire backend.** It provides:
  1. **PostgreSQL Database** — where all data lives (products, entries, chat history, users)
  2. **File Storage** — uploading PDFs, images, documents
  3. **pgvector** — vector similarity search for Ask Budda
  4. **Dashboard** — for managing tables, running SQL, creating storage buckets
  
  **Drizzle is the ORM** that connects to the Supabase PostgreSQL database. Instead of using the Supabase JS Client to read/write data (which is fine but less type-safe), we use Drizzle for all regular database queries. This gives us full TypeScript type safety, cleaner code, and better control.
  
  **The Supabase JS Client (@supabase/supabase-js)** is still needed for two things that Drizzle can't do well:
  1. **File Storage** — Supabase has a dedicated storage API for uploading/downloading files
  2. **Vector search RPC** — calling the `match_entries` Postgres function for semantic search (Drizzle doesn't have native pgvector function call support)
  
  **In simple terms:**
  - Reading/writing products, entries, chat messages → **Drizzle**
  - Uploading/downloading files → **Supabase JS Client**
  - Semantic vector search → **Supabase JS Client (RPC)**
  - Auth → **Better Auth** (not Supabase Auth)
  
  Install the Supabase client:
  
  ```bash
  bun add @supabase/supabase-js
  ```
  
  Create a Supabase client for Storage and vector search:
  
  ```typescript
  // lib/supabase/client.ts
  import { createClient } from "@supabase/supabase-js";
  
  // Used for: file storage uploads/downloads and vector search RPC
  // NOT used for: auth or regular database queries (those go through Drizzle)
  export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  ```
  
  Server-side client (for API routes — bypasses RLS):
  
  ```typescript
  // lib/supabase/server.ts
  import { createClient } from "@supabase/supabase-js";
  
  // Server-side client with elevated permissions for file operations
  export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```
  
  ---
  
  ## 2. Environment Variables (Complete)
  
  Create a `.env` or `.env.local` file with ALL of these:
  
  ```env
  # ─── Database (Drizzle connects here directly) ───
  # Find this in Supabase → Settings → Database → Connection string → URI
  DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  
  # ─── Supabase (Storage + vector search ONLY) ───
  NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
  
  # ─── Google Gemini AI ───
  GEMINI_API_KEY=your-gemini-api-key
  
  # ─── Google OAuth + Drive ───
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_CLIENT_SECRET=your-google-client-secret
  
  # ─── Better Auth ───
  BETTER_AUTH_SECRET=generate-a-random-32-char-string-here
  BETTER_AUTH_URL=http://localhost:3000
  
  # ─── App ───
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
  
  **How to get each value:**
  
  | Variable | Where to get it |
  |----------|----------------|
  | DATABASE_URL | Supabase → Settings → Database → Connection string → URI (use the "Transaction" pooler for serverless) |
  | SUPABASE_URL | Supabase → Settings → API → Project URL |
  | SUPABASE_ANON_KEY | Supabase → Settings → API → anon/public key |
  | SUPABASE_SERVICE_ROLE_KEY | Supabase → Settings → API → service_role key (keep secret!) |
  | GEMINI_API_KEY | https://aistudio.google.com/apikey → Create API Key |
  | GOOGLE_CLIENT_ID | Google Cloud Console → APIs & Services → Credentials → OAuth Client ID |
  | GOOGLE_CLIENT_SECRET | Same place as Client ID |
  | BETTER_AUTH_SECRET | Run in terminal: `openssl rand -base64 32` or type any random 32+ character string |
  
  ---
  
  ## 3. Gemini AI — Complete Implementation
  
  ### 3.1 Install
  
  ```bash
  bun add @google/generative-ai
  ```
  
  ### 3.2 Gemini Client
  
  ```typescript
  // lib/gemini/client.ts
  import { GoogleGenerativeAI } from "@google/generative-ai";
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  
  // For text generation and Q&A
  export const geminiFlash = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });
  
  // For embeddings (vector search)
  export const geminiEmbedding = genAI.getGenerativeModel({
    model: "text-embedding-004",
  });
  ```
  
  ### 3.3 Text Extraction from Files
  
  ```typescript
  // lib/gemini/extract.ts
  import { geminiFlash } from "./client";
  
  // Extract text from a PDF (base64 encoded)
  export async function extractTextFromPDF(base64Data: string): Promise<string> {
    const result = await geminiFlash.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
      {
        text: "Extract ALL the text content from this document. Return the full text as-is, preserving structure including headings, bullet points, and paragraphs. Do not summarize — return everything.",
      },
    ]);
  
    return result.response.text();
  }
  
  // Extract text/description from an image
  export async function extractTextFromImage(
    base64Data: string,
    mimeType: string
  ): Promise<string> {
    const result = await geminiFlash.generateContent([
      {
        inlineData: {
          mimeType: mimeType, // e.g. "image/png", "image/jpeg"
          data: base64Data,
        },
      },
      {
        text: "Describe this image in detail. Extract any visible text. If it's a wireframe, diagram, or flowchart, describe the structure and all elements. If it's a screenshot, describe the UI and any text shown.",
      },
    ]);
  
    return result.response.text();
  }
  
  // Extract text from any supported document
  export async function extractText(
    base64Data: string,
    mimeType: string
  ): Promise<string> {
    if (mimeType === "application/pdf") {
      return extractTextFromPDF(base64Data);
    }
  
    if (mimeType.startsWith("image/")) {
      return extractTextFromImage(base64Data, mimeType);
    }
  
    // For text-based files (txt, csv, etc.) — decode directly
    if (
      mimeType.includes("text/") ||
      mimeType.includes("csv") ||
      mimeType.includes("json")
    ) {
      return Buffer.from(base64Data, "base64").toString("utf-8");
    }
  
    // For other documents (docx, pptx, xlsx) — send to Gemini
    const result = await geminiFlash.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
      {
        text: "Extract ALL the text content from this document. Return the full text preserving structure.",
      },
    ]);
  
    return result.response.text();
  }
  ```
  
  ### 3.4 Generate Embeddings
  
  ```typescript
  // lib/gemini/embed.ts
  import { GoogleGenerativeAI } from "@google/generative-ai";
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  
  export async function generateEmbedding(text: string): Promise<number[]> {
    // Truncate to ~8000 tokens worth of text (roughly 32000 chars)
    // Gemini embedding model has input limits
    const truncated = text.slice(0, 32000);
  
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(truncated);
  
    return result.embedding.values; // Returns 768-dimension float array
  }
  ```
  
  ### 3.5 Ask Budda — Q&A
  
  ```typescript
  // lib/gemini/ask.ts
  import { geminiFlash } from "./client";
  
  interface Entry {
    title: string;
    content: string | null;
    context: string | null;
    entryType: string;
    source: string;
    link: string | null;
    date: string;
  }
  
  export async function askBudda(
    productName: string,
    productDescription: string,
    entries: Entry[],
    conversationHistory: { role: "user" | "assistant"; text: string }[],
    question: string
  ): Promise<string> {
    // Build context from relevant entries
    const entriesContext = entries
      .map(
        (e) =>
          `─── [${e.entryType}] ${e.title} ───
  Source: ${e.source}
  Date: ${e.date}
  ${e.link ? `Original Link: ${e.link}` : ""}
  ${e.context ? `Context: ${e.context}` : ""}
  
  Content:
  ${e.content || "[No content]"}`
      )
      .join("\n\n═══════════\n\n");
  
    const systemPrompt = `You are Budda — a product memory assistant for "${productName}" (${productDescription}).
  
  You have access to the following documents and entries for this product:
  
  ${entriesContext}
  
  RULES — follow these strictly:
  1. Answer ONLY from the provided documents. Never fabricate information.
  2. If the answer is not in the documents, say: "I don't have that in my memory yet. Try feeding it to me!"
  3. Be concise and scannable — PMs are busy. Use short paragraphs.
  4. ALWAYS reference which document/entry you are pulling information from, by its title.
  5. ALWAYS include original links when they exist. If an entry has a Figma link, Drive link, YouTube link, or any URL — include it in your response so the PM can access the original file.
  6. When asked to "find a document" or "give me the doc about X" — search through entries, return the most relevant one with its full content and original link.
  7. For change logs, clearly state what changed.
  8. Flag when you are making an inference vs stating a fact from the documents.
  9. Speak warmly but efficiently, like a wise assistant who knows everything about this product.`;
  
    // Build conversation history for Gemini
    const history = conversationHistory.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.text }],
    }));
  
    const chat = geminiFlash.startChat({
      history: history,
      systemInstruction: systemPrompt,
    });
  
    const result = await chat.sendMessage(question);
    return result.response.text();
  }
  ```
  
  ---
  
  ## 4. File Upload — Complete Flow
  
  ### 4.1 Supabase Storage Setup
  
  **Do this manually in the Supabase dashboard:**
  
  1. Go to Supabase → Storage
  2. Create bucket: `documents` (private)
  3. Create bucket: `images` (private)
  4. For each bucket, add this RLS policy:
     - Policy name: "Users can upload their own files"
     - Operation: INSERT
     - Policy: `(auth.uid() IS NOT NULL)` — or for simplicity during MVP, just allow all authenticated uploads
  5. Add a SELECT policy too so users can read their own files
  
  **Since we're NOT using Supabase Auth, we'll use the service_role key for uploads (server-side only).** This bypasses RLS. This is fine for MVP because all file operations happen through our API routes which are already protected by Better Auth.
  
  ### 4.2 Upload API Route
  
  ```typescript
  // app/api/entries/upload/route.ts
  import { NextRequest, NextResponse } from "next/server";
  import { supabaseAdmin } from "@/lib/supabase/server";
  import { extractText } from "@/lib/gemini/extract";
  import { generateEmbedding } from "@/lib/gemini/embed";
  import { db } from "@/lib/db";
  import { entries } from "@/lib/db/schema";
  import { createHash } from "crypto";
  
  export async function POST(req: NextRequest) {
    // 1. Verify user is authenticated (via Better Auth)
    // Get the session/user from Better Auth
    // If not authenticated, return 401
  
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const title = formData.get("title") as string;
      const context = formData.get("context") as string;
      const entryType = formData.get("entryType") as string;
      const source = formData.get("source") as string;
      const productId = formData.get("productId") as string;
      const userId = formData.get("userId") as string; // From session
  
      if (!file || !title || !productId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
  
      // 2. Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
  
      // 3. Upload to Supabase Storage
      const bucket = file.type.startsWith("image/") ? "images" : "documents";
      const filePath = `${userId}/${productId}/${Date.now()}-${file.name}`;
  
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });
  
      if (uploadError) {
        console.error("Upload error:", uploadError);
        return NextResponse.json({ error: "File upload failed" }, { status: 500 });
      }
  
      // 4. Extract text using Gemini
      let extractedContent = "";
      try {
        extractedContent = await extractText(base64, file.type);
      } catch (err) {
        extractedContent = `[File uploaded: ${file.name}] — Automatic text extraction failed.`;
      }
  
      // 5. Generate embedding
      let embedding: number[] | null = null;
      try {
        if (extractedContent && extractedContent.length > 10) {
          embedding = await generateEmbedding(extractedContent);
        }
      } catch (err) {
        console.error("Embedding error:", err);
        // Continue without embedding — search will still work via text
      }
  
      // 6. Generate content hash (for change tracking)
      const contentHash = createHash("md5").update(extractedContent).digest("hex");
  
      // 7. Save entry to database via Drizzle
      const [newEntry] = await db.insert(entries).values({
        productId,
        userId,
        title,
        content: extractedContent,
        context: context || null,
        entryType: entryType || "Other",
        source: source || "Manual",
        filePath: uploadData.path,
        fileName: file.name,
        fileType: file.type,
        contentHash,
        embedding: embedding, // pgvector stores this as vector(768)
      }).returning();
  
      return NextResponse.json({ entry: newEntry }, { status: 201 });
    } catch (err) {
      console.error("Upload processing error:", err);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }
  ```
  
  ### 4.3 Link Entry (no file upload)
  
  ```typescript
  // app/api/entries/route.ts
  import { NextRequest, NextResponse } from "next/server";
  import { generateEmbedding } from "@/lib/gemini/embed";
  import { db } from "@/lib/db";
  import { entries } from "@/lib/db/schema";
  import { eq, and, desc } from "drizzle-orm";
  import { createHash } from "crypto";
  
  // CREATE entry (for links, AI chats, manual text)
  export async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      const { productId, userId, title, content, context, entryType, source, link } = body;
  
      if (!productId || !userId || !title) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
  
      // Generate embedding if we have content
      let embedding: number[] | null = null;
      const textToEmbed = [title, content, context].filter(Boolean).join(" ");
      if (textToEmbed.length > 10) {
        try {
          embedding = await generateEmbedding(textToEmbed);
        } catch (err) {
          console.error("Embedding error:", err);
        }
      }
  
      const contentHash = content
        ? createHash("md5").update(content).digest("hex")
        : null;
  
      const [newEntry] = await db.insert(entries).values({
        productId,
        userId,
        title,
        content: content || null,
        context: context || null,
        entryType: entryType || "Other",
        source: source || "Manual",
        link: link || null,
        contentHash,
        embedding,
      }).returning();
  
      return NextResponse.json({ entry: newEntry }, { status: 201 });
    } catch (err) {
      console.error("Create entry error:", err);
      return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
    }
  }
  
  // GET entries for a product
  export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const entryType = searchParams.get("type");
    const source = searchParams.get("source");
  
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }
  
    let query = db.select().from(entries)
      .where(eq(entries.productId, productId))
      .orderBy(desc(entries.createdAt));
  
    const results = await query;
  
    // Filter in JS for simplicity (or build dynamic where clauses)
    let filtered = results;
    if (entryType) {
      filtered = filtered.filter((e) => e.entryType === entryType);
    }
    if (source) {
      filtered = filtered.filter((e) => e.source === source);
    }
  
    return NextResponse.json({ entries: filtered });
  }
  
  // DELETE entry
  export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
  
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
  
    await db.delete(entries).where(eq(entries.id, id));
    return NextResponse.json({ success: true });
  }
  ```
  
  ---
  
  ## 5. pgvector + Drizzle — Semantic Search
  
  ### 5.1 Enable pgvector in Supabase
  
  **Do this once, manually, in Supabase SQL Editor:**
  
  ```sql
  -- Enable the vector extension
  create extension if not exists vector with schema extensions;
  ```
  
  ### 5.2 Drizzle Schema — Vector Column
  
  Drizzle supports pgvector via the `drizzle-orm/pg-core` vector type. Make sure this import is in your schema:
  
  ```typescript
  // In your Drizzle schema file
  import { vector } from "drizzle-orm/pg-core";
  
  // The entries table should have:
  embedding: vector("embedding", { dimensions: 768 }),
  ```
  
  If Drizzle's built-in vector type doesn't work with your version, use a custom type:
  
  ```typescript
  import { customType } from "drizzle-orm/pg-core";
  
  const vectorType = customType<{ data: number[]; dpiName: string }>({
    dataType() {
      return "vector(768)";
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string) {
      return value
        .replace("[", "")
        .replace("]", "")
        .split(",")
        .map(Number);
    },
  });
  ```
  
  ### 5.3 Create the Search Function in Supabase
  
  **Run this SQL in Supabase SQL Editor (one time):**
  
  ```sql
  create or replace function match_entries(
    query_embedding vector(768),
    match_product_id uuid,
    match_count int default 10,
    match_threshold float default 0.3
  )
  returns table (
    id uuid,
    title text,
    content text,
    context text,
    entry_type text,
    source text,
    link text,
    similarity float
  )
  language sql stable
  as $$
    select
      entries.id,
      entries.title,
      entries.content,
      entries.context,
      entries.entry_type,
      entries.source,
      entries.link,
      1 - (entries.embedding <=> query_embedding) as similarity
    from public.entries
    where entries.product_id = match_product_id
      and entries.embedding is not null
      and 1 - (entries.embedding <=> query_embedding) > match_threshold
    order by entries.embedding <=> query_embedding
    limit match_count;
  $$;
  ```
  
  ### 5.4 Calling Semantic Search from Code
  
  Since Drizzle doesn't have native support for calling Supabase RPC functions, we use the Supabase client specifically for this:
  
  ```typescript
  // lib/search.ts
  import { supabaseAdmin } from "@/lib/supabase/server";
  import { generateEmbedding } from "@/lib/gemini/embed";
  
  export interface SearchResult {
    id: string;
    title: string;
    content: string;
    context: string;
    entry_type: string;
    source: string;
    link: string;
    similarity: number;
  }
  
  export async function semanticSearch(
    query: string,
    productId: string,
    topK: number = 15
  ): Promise<SearchResult[]> {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
  
    // 2. Call the Supabase RPC function
    const { data, error } = await supabaseAdmin.rpc("match_entries", {
      query_embedding: queryEmbedding,
      match_product_id: productId,
      match_count: topK,
      match_threshold: 0.3,
    });
  
    if (error) {
      console.error("Semantic search error:", error);
      // Fallback: return all entries for this product (via Drizzle)
      return [];
    }
  
    return data as SearchResult[];
  }
  ```
  
  ### 5.5 Ask Budda API Route (Putting It All Together)
  
  ```typescript
  // app/api/ai/ask/route.ts
  import { NextRequest, NextResponse } from "next/server";
  import { semanticSearch } from "@/lib/search";
  import { askBudda } from "@/lib/gemini/ask";
  import { db } from "@/lib/db";
  import { products, chatMessages } from "@/lib/db/schema";
  import { eq } from "drizzle-orm";
  
  export async function POST(req: NextRequest) {
    try {
      const { productId, userId, question, history } = await req.json();
  
      if (!productId || !question) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
  
      // 1. Get product info
      const [product] = await db.select().from(products)
        .where(eq(products.id, productId));
  
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
  
      // 2. Semantic search — find relevant entries
      const relevantEntries = await semanticSearch(question, productId, 15);
  
      // 3. If semantic search returned nothing, fall back to all entries
      let entriesToUse = relevantEntries;
      if (entriesToUse.length === 0) {
        // Fallback: use Drizzle to get all entries for this product
        const { entries } = await import("@/lib/db/schema");
        const allEntries = await db.select().from(entries)
          .where(eq(entries.productId, productId));
  
        entriesToUse = allEntries.map((e) => ({
          id: e.id,
          title: e.title,
          content: e.content || "",
          context: e.context || "",
          entry_type: e.entryType,
          source: e.source,
          link: e.link || "",
          similarity: 1,
        }));
      }
  
      // 4. Format entries for Gemini
      const formattedEntries = entriesToUse.map((e) => ({
        title: e.title,
        content: e.content,
        context: e.context,
        entryType: e.entry_type,
        source: e.source,
        link: e.link,
        date: "", // Not returned by search, that's fine
      }));
  
      // 5. Ask Gemini
      const answer = await askBudda(
        product.name,
        product.description || "",
        formattedEntries,
        history || [],
        question
      );
  
      // 6. Save both messages to chat history
      await db.insert(chatMessages).values([
        {
          productId,
          userId,
          role: "user",
          content: question,
        },
        {
          productId,
          userId,
          role: "assistant",
          content: answer,
        },
      ]);
  
      return NextResponse.json({ answer });
    } catch (err) {
      console.error("Ask Budda error:", err);
      return NextResponse.json(
        { error: "Budda's thinking got interrupted. Try again." },
        { status: 500 }
      );
    }
  }
  ```
  
  ---
  
  ## 6. Google Drive — Reading Documents
  
  ### 6.1 Refreshing Google OAuth Token
  
  When a user's access token expires, we need to refresh it:
  
  ```typescript
  // lib/drive/token.ts
  export async function refreshGoogleToken(refreshToken: string): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  
    const data = await response.json();
    return data.access_token;
  }
  ```
  
  ### 6.2 Reading Drive Files
  
  ```typescript
  // lib/drive/client.ts
  import { refreshGoogleToken } from "./token";
  import { extractText } from "@/lib/gemini/extract";
  
  export function extractFileIdFromUrl(url: string): string | null {
    // Matches Google Drive/Docs/Sheets/Slides file IDs
    const patterns = [
      /\/d\/([a-zA-Z0-9_-]{25,})/,
      /id=([a-zA-Z0-9_-]{25,})/,
      /\/folders\/([a-zA-Z0-9_-]{25,})/,
    ];
  
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
  
    return null;
  }
  
  export async function readDriveFile(
    fileUrl: string,
    accessToken: string,
    refreshToken: string
  ): Promise<{ content: string; title: string; mimeType: string }> {
    const fileId = extractFileIdFromUrl(fileUrl);
    if (!fileId) throw new Error("Could not extract file ID from URL");
  
    // Try with current token, refresh if needed
    let token = accessToken;
  
    // 1. Get file metadata
    let metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  
    if (metaRes.status === 401) {
      token = await refreshGoogleToken(refreshToken);
      metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
  
    const meta = await metaRes.json();
  
    // 2. Download content based on type
    let content = "";
  
    if (meta.mimeType === "application/vnd.google-apps.document") {
      // Google Doc → export as plain text
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      content = await res.text();
    } else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
      // Google Sheet → export as CSV
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      content = await res.text();
    } else if (meta.mimeType === "application/vnd.google-apps.presentation") {
      // Google Slides → export as plain text
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      content = await res.text();
    } else if (meta.mimeType === "application/pdf") {
      // PDF → download and send to Gemini
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString("base64");
      content = await extractText(base64, "application/pdf");
    } else {
      // Other files → try to download and extract
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString("base64");
      try {
        content = await extractText(base64, meta.mimeType);
      } catch {
        content = `[Google Drive file: ${meta.name}] — Could not extract text from this file type (${meta.mimeType}).`;
      }
    }
  
    return {
      content,
      title: meta.name || "Untitled Drive Document",
      mimeType: meta.mimeType,
    };
  }
  ```
  
  ---
  
  ## 7. Change Tracking — Implementation
  
  ```typescript
  // lib/changes.ts
  import { db } from "@/lib/db";
  import { entries } from "@/lib/db/schema";
  import { eq } from "drizzle-orm";
  import { createHash } from "crypto";
  
  export async function checkForChanges(
    entryId: string,
    newContent: string
  ): Promise<boolean> {
    const newHash = createHash("md5").update(newContent).digest("hex");
  
    const [existing] = await db.select({
      contentHash: entries.contentHash,
    }).from(entries).where(eq(entries.id, entryId));
  
    if (!existing || !existing.contentHash) return false;
  
    if (existing.contentHash !== newHash) {
      // Content has changed!
      await db.update(entries).set({
        previousContentHash: existing.contentHash,
        contentHash: newHash,
        content: newContent,
        hasChanges: true,
        updatedAt: new Date(),
      }).where(eq(entries.id, entryId));
  
      return true;
    }
  
    return false;
  }
  
  // Get all changed entries for a product
  export async function getChangedEntries(productId: string) {
    return db.select().from(entries)
      .where(
        eq(entries.productId, productId)
      )
      .then((results) => results.filter((e) => e.hasChanges === true));
  }
  
  // Mark changes as seen
  export async function clearChangeFlag(entryId: string) {
    await db.update(entries).set({
      hasChanges: false,
    }).where(eq(entries.id, entryId));
  }
  ```
  
  ---
  
  ## 8. Deployment to Vercel
  
  ### 8.1 Prerequisites
  
  1. Push your code to GitHub
  2. Create a Vercel account (free) at vercel.com
  3. Connect your GitHub repo to Vercel
  
  ### 8.2 Vercel Configuration
  
  Create `vercel.json` in the project root:
  
  ```json
  {
    "buildCommand": "bun run build",
    "installCommand": "bun install",
    "framework": "nextjs"
  }
  ```
  
  If the project is in a monorepo structure from Better-T-Stack:
  ```json
  {
    "buildCommand": "cd apps/web && bun run build",
    "installCommand": "bun install",
    "framework": "nextjs",
    "rootDirectory": "apps/web"
  }
  ```
  
  ### 8.3 Environment Variables in Vercel
  
  In Vercel dashboard → Your Project → Settings → Environment Variables, add ALL variables from Section 2 of this document. Change:
  
  ```
  BETTER_AUTH_URL=https://your-domain.vercel.app
  NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
  ```
  
  ### 8.4 Google OAuth — Update Redirect URI
  
  Add your production URL to Google OAuth authorized redirect URIs:
  ```
  https://your-domain.vercel.app/api/auth/callback/google
  ```
  
  ### 8.5 Deploy
  
  ```bash
  # Option 1: Auto-deploy (push to GitHub → Vercel deploys automatically)
  git push origin main
  
  # Option 2: Manual deploy via Vercel CLI
  bun add -g vercel
  vercel --prod
  ```
  
  ---
  
  ## 9. Updated Build Order (for Better-T-Stack project)
  
  This replaces the build order in Part 1. Follow this exactly.
  
  ### Phase 0: Understand the scaffolded project (30 minutes)
  ```
  Step 0.1: Explore the file structure — find where Drizzle, auth, and Next.js app live
  Step 0.2: Run `bun run dev` and verify the scaffolded app works
  Step 0.3: Identify the Drizzle config file, schema file, and DB client file
  Step 0.4: Identify the Better Auth config file
  ```
  
  ### Phase 1: Database + Auth (Day 1)
  ```
  Step 1.1: Set up Supabase project, enable pgvector extension
  Step 1.2: Add the entries, products, chat_messages tables to the existing Drizzle schema (profiles may already exist from Better Auth)
  Step 1.3: Run Drizzle migrations: `bun run db:push` or `bunx drizzle-kit push`
  Step 1.4: Configure Google OAuth in Better Auth config (add Drive scope)
  Step 1.5: Set up all environment variables
  Step 1.6: Install additional packages: @supabase/supabase-js, @google/generative-ai
  Step 1.7: Create lib/supabase/client.ts and lib/supabase/server.ts (storage only)
  Step 1.8: Test: login with Google should work
  ```
  
  ### Phase 2: AI Layer (Day 2)
  ```
  Step 2.1: Create lib/gemini/client.ts
  Step 2.2: Create lib/gemini/extract.ts (text extraction)
  Step 2.3: Create lib/gemini/embed.ts (embedding generation)
  Step 2.4: Create lib/gemini/ask.ts (Q&A)
  Step 2.5: Create lib/search.ts (semantic search via Supabase RPC)
  Step 2.6: Create lib/drive/client.ts and lib/drive/token.ts
  Step 2.7: Create the match_entries SQL function in Supabase
  Step 2.8: Test: generate an embedding, verify it returns 768 numbers
  ```
  
  ### Phase 3: API Routes (Day 3-4)
  ```
  Step 3.1: Products CRUD API (create, list, delete)
  Step 3.2: Entries CRUD API (create for text/links, list with filters, delete)
  Step 3.3: File upload API (upload + extract + embed + save)
  Step 3.4: Google Drive read API
  Step 3.5: Ask Budda API (search + context + Gemini Q&A)
  Step 3.6: Change tracking helpers
  Step 3.7: Test all APIs with curl or Postman
  ```
  
  ### Phase 4: Frontend — Products (Day 5-6)
  ```
  Step 4.1: Products home page — grid of product cards
  Step 4.2: Create product dialog
  Step 4.3: Delete product with confirmation
  Step 4.4: Product detail layout with tabs
  Step 4.5: Entry list with expand/collapse
  Step 4.6: Filter tabs (All, Documents, Design, Links, AI Chats, Changes)
  Step 4.7: Search bar
  Step 4.8: Source badges, type icons, context previews
  ```
  
  ### Phase 5: Frontend — Feed Budda (Day 7-8)
  ```
  Step 5.1: Feed Budda page with 5 mode tabs
  Step 5.2: Document upload mode (file picker + upload + processing indicator)
  Step 5.3: Link mode (URL input + auto-detection)
  Step 5.4: AI Chat mode (source selector + text area)
  Step 5.5: Image upload mode (file picker + preview)
  Step 5.6: Google Drive mode (URL input + auto-read)
  Step 5.7: Context note field on all modes
  Step 5.8: Processing states ("Budda is reading your document...")
  ```
  
  ### Phase 6: Frontend — Ask Budda (Day 9-10)
  ```
  Step 6.1: Chat interface with message bubbles
  Step 6.2: Suggested prompt buttons
  Step 6.3: Send question → show loading → display answer
  Step 6.4: Conversation history (persisted)
  Step 6.5: Links in answers should be clickable
  Step 6.6: "Open original" buttons on referenced entries
  ```
  
  ### Phase 7: Change Tracking + Polish (Day 11-12)
  ```
  Step 7.1: "Documents updated" banner on product page
  Step 7.2: Visual indicator on changed entries
  Step 7.3: Landing page
  Step 7.4: Loading skeletons and empty states
  Step 7.5: Error handling on all API routes and UI
  Step 7.6: Mobile responsive design
  ```
  
  ### Phase 8: Deploy (Day 13)
  ```
  Step 8.1: Push to GitHub
  Step 8.2: Connect to Vercel
  Step 8.3: Add environment variables in Vercel
  Step 8.4: Update Google OAuth redirect URI for production
  Step 8.5: Deploy and test
  Step 8.6: Custom domain (optional)
  ```
  
  ---
  
  ## 10. Supabase Setup Checklist
  
  Do these steps manually in the Supabase dashboard before building:
  
  - [ ] Create new Supabase project
  - [ ] Go to SQL Editor → run: `create extension if not exists vector with schema extensions;`
  - [ ] Go to SQL Editor → run the `match_entries` function from Section 5.3
  - [ ] Go to Storage → create bucket `documents` (private)
  - [ ] Go to Storage → create bucket `images` (private)
  - [ ] Go to Settings → Database → copy Connection String (URI) → use as DATABASE_URL
  - [ ] Go to Settings → API → copy Project URL → use as SUPABASE_URL
  - [ ] Go to Settings → API → copy anon key → use as SUPABASE_ANON_KEY
  - [ ] Go to Settings → API → copy service_role key → use as SUPABASE_SERVICE_ROLE_KEY
  
  ---
  
  ## END OF SUPPLEMENTARY SPECIFICATION
  
  **Architecture summary — read this carefully:**
  
  | What | Tool | How |
  |------|------|-----|
  | Database (PostgreSQL) | **Supabase** | Hosts the database. Tables created via Drizzle migrations. |
  | Database queries (CRUD) | **Drizzle ORM** | All reads/writes to products, entries, chat_messages go through Drizzle connecting to Supabase PostgreSQL via DATABASE_URL |
  | File storage (PDFs, images) | **Supabase JS Client** | Uses Supabase Storage API for uploading/downloading files |
  | Vector similarity search | **Supabase JS Client** | Calls the match_entries RPC function (pgvector) — Drizzle can't do this natively |
  | Auth (login, sessions) | **Better Auth** | Google OAuth + email/password. NOT Supabase Auth. |
  | AI (extraction, Q&A, embeddings) | **Google Gemini API** | Text extraction, Ask Budda Q&A, embedding generation |
  | Google Drive reading | **Google Drive API v3** | Direct API calls using stored OAuth tokens |
  
  **How to use these two documents with Claude Code:**
  
  1. First, paste Part 1 (Budda_Technical_Spec.md) — this gives Claude Code the full picture
  2. Then, paste Part 2 (THIS file) — this tells Claude Code "here are corrections and implementation details"
  3. Tell Claude Code: "When Part 1 and Part 2 conflict, Part 2 wins. The project is already scaffolded with Better-T-Stack. Do NOT restructure. Adapt to the existing project."
  4. Follow the build order in Section 9 of Part 2 (not Part 1)
