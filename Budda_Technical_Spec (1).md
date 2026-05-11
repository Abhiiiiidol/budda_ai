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
| Database | Supabase (PostgreSQL) | latest | Data storage, auth, file storage |
| ORM | Drizzle ORM | latest | Type-safe database queries |
| Vector Search | pgvector (Supabase extension) | latest | Semantic document search |
| AI | Google Gemini API | gemini-2.0-flash | Text extraction, Q&A, embeddings |
| Embeddings | Gemini Embedding API | text-embedding-004 | Document vectorization |
| File Storage | Supabase Storage | latest | PDF, image, document uploads |
| Google Drive | Google Drive API v3 | v3 | Read Drive documents |
| Auth | Supabase Auth | latest | Google OAuth + email login |
| Hosting | Vercel | latest | Deployment |
| Package Manager | pnpm | latest | Dependencies |

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

**Key architecture rule: Supabase is used for Auth and File Storage ONLY. All database reads and writes go through Drizzle ORM connecting directly to the Supabase PostgreSQL database. The only exception is the vector similarity search (match_entries), which uses Supabase RPC because pgvector operations are easier through the Supabase client.**
