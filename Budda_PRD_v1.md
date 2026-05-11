# Budda — Product Requirements Document

**Version:** 1.0
**Date:** May 2026
**Author:** Product Team
**Status:** MVP

> *Confidential*

---

## 1. Overview

### 1.1 Product Summary

Budda is a product memory agent designed for product managers who juggle multiple products simultaneously. It stores, reads, and recalls every document, link, decision, and piece of context across all products — so no PM ever loses track of what happened, why it happened, or where the original file lives.

### 1.2 Problem Statement

Product managers work on multiple products at the same time. They build products from 0 to 1 while also iterating on existing features from N to N+1. For each product, they create and consume a massive volume of artifacts: PRDs, requirement documents, designs, flow diagrams, research findings, meeting notes, AI chat outputs, and more.

The core problem is the **context gap**. Once a PM ships a product and moves to the next, weeks or months pass. When they need to revisit an older product, they have lost the context — what decisions were made, why things were designed a certain way, where the documents live, and how different pieces connect. Searching through Google Drive, Notion, Slack, and email to reconstruct this context is slow, frustrating, and often incomplete.

### 1.3 Target Users

**Primary:** Product managers managing 3 or more products simultaneously, working across cross-functional teams including design, engineering, and stakeholders.

**Secondary:** Any team member who needs to quickly get up to speed on a product they were not originally involved in.

### 1.4 Product Vision

> *Never lose context on any product, ever.*

Budda is a memory tool, not a project management tool. It does not track sprints, tickets, or deadlines. It remembers everything about your products so you do not have to.

---

## 2. Features

### 2.1 Multi-Product Workspaces

Each product gets its own isolated workspace. A PM can create as many workspaces as needed. The home screen shows all products at a glance with a quick snapshot: number of documents, number of sources, entry count, and the sources feeding into each product.

| Attribute   | Detail                                                             |
|-------------|--------------------------------------------------------------------|
| Input       | Product name and optional description                              |
| Display     | Product cards with entry count, source badges, memory count        |
| Actions     | Create, open, delete products                                      |
| Persistence | All data persists across sessions                                  |

### 2.2 Feed Budda (Smart Ingestion)

The primary input interface. Inside each product workspace, the PM can feed Budda any type of content through a unified interface with five input modes.

#### 2.2.1 Document Upload

Upload PDFs, Google Docs, Sheets, PPTs, or any text-based file directly. Budda reads the full content using AI-powered text extraction and stores it. The PM adds a one-line context note explaining why this document matters.

#### 2.2.2 Link Ingestion

Paste any URL: Figma designs, YouTube videos, competitor websites, articles, Notion pages. Budda auto-detects the link type and displays the appropriate source icon and category. The PM adds context for why this link is relevant to the product.

#### 2.2.3 AI Chat Export

Paste outputs from ChatGPT, Claude, Perplexity, or any AI tool. Select which AI it came from. Add context about what question was being solved and how the output was used. This preserves the reasoning and research that AI tools contributed to product decisions.

#### 2.2.4 Image Upload

Upload screenshots, whiteboard photos, wireframe captures, or any visual artifact. Budda extracts or describes the content using AI vision. The PM adds context about what the image represents and why it matters.

#### 2.2.5 Google Drive Integration

Paste a Google Drive URL. Budda automatically fetches and reads the entire document (Google Docs, PDFs, Sheets, PPTs). It stores both the full content for searchability AND keeps the original link for direct access. If the document is updated in Drive, Budda detects the changes on the next sync.

> **Critical Design Decision:** Every single entry has two parts — the actual content and a human-written context note. The content tells Budda *what*. The context tells Budda *why*. This is Budda's core differentiator.

### 2.3 Auto-Detection

When a link is pasted into Budda, it automatically detects the platform and categorizes it with the correct icon and source tag. No manual selection is needed for recognized platforms.

| URL Pattern                                  | Detected Source | Default Type  |
|----------------------------------------------|-----------------|---------------|
| figma.com/*                                  | Figma           | Design        |
| youtube.com/*, youtu.be/*                    | YouTube         | Link          |
| docs.google.com/*, drive.google.com/*        | Google Drive    | Auto-detected |
| chat.openai.com/*, chatgpt.com/*             | ChatGPT         | AI Chat       |
| claude.ai/*                                  | Claude          | AI Chat       |
| perplexity.ai/*                              | Perplexity      | AI Chat       |
| Any other URL                                | Website         | Link          |

### 2.4 Ask Budda (AI-Powered Q&A)

A conversational chat interface where the PM can ask any question about a product. Budda reads all entries — documents, links, AI chats, images, change logs, everything — and answers based purely on what has been fed to it.

#### 2.4.1 Supported Query Types

| Query Type              | Example Queries                                                                                              |
|-------------------------|--------------------------------------------------------------------------------------------------------------|
| Recall & Retrieval      | "What was the timeline we decided on?" — "What tech stack did we pick?" — "Who are the stakeholders?"        |
| Summarization           | "Give me a quick summary of this product" — "What are the top features?" — "Summarize the user research"     |
| Document Search         | "Find me the feature description document" — "Which doc talks about auth?" — "Show me what I got from Claude"|
| Decision Archaeology    | "What decisions have changed?" — "What was the original scope vs current?" — "Why did we drop mobile?"       |
| Cross-Source Synthesis  | "What did Claude suggest for auth and does the tech spec match?" — "Compare research findings with the PRD"  |
| Resource Finding        | "What are all the Figma links?" — "Show me all competitor references" — "What YouTube videos did I save?"    |
| Onboarding              | "Explain this product like I'm a new engineer joining the team"                                              |

#### 2.4.2 Link Return

Whenever Budda references a document in a conversation, it always includes the link to the original source — the Google Drive file, the Figma board, the YouTube video, the competitor website. The PM gets the answer AND the path back to the original artifact.

#### 2.4.3 Honesty Constraint

Budda never fabricates information. If the answer is not contained in the fed documents, Budda explicitly states this. It will say: *"I don't have that in my memory. Try feeding it to me!"* This ensures the PM always trusts Budda's responses.

### 2.5 Document Change Tracking

Every time Budda re-reads a document (on sync or re-feed), it compares the current version with the previously stored version. If content has changed, Budda flags it with a notification: *"3 documents updated since last sync."*

The change tracking shows what sections changed, not why. The PM made the changes and knows the reason — Budda just provides the heads-up so nothing slips through the cracks.

### 2.6 Smart Filtering & Browsing

Inside each product workspace, the PM can browse all entries through multiple filter views.

| Filter     | What It Shows                                                      |
|------------|--------------------------------------------------------------------|
| All        | Every entry in the product                                         |
| Documents  | PRDs, Tech Specs, Research, Specs, Meeting Notes                   |
| Design     | Figma entries and any entry typed as Design                        |
| Links      | All entries with external URLs                                     |
| AI Chats   | Entries sourced from ChatGPT, Claude, or Perplexity                |
| Changes    | All Change Log entries                                             |

A search bar allows free-text search across titles, content, context notes, and source tags.

### 2.7 Source Awareness

Every entry is tagged with its origin source: Manual, Figma, Claude, ChatGPT, Perplexity, YouTube, Google Drive, Website, or Image. This enables source-specific queries ("What did AI tools suggest?") and helps the PM trace the provenance of any piece of information.

Each source is visually distinguished with unique colors and icons for instant recognition when browsing.

### 2.8 Context Layer

Every entry in Budda carries a human-written context note alongside the actual content. This is not optional metadata — it is a core part of Budda's value proposition.

The context note captures: why this document matters, what decision it relates to, how it connects to other entries, and any nuance that the raw content alone does not convey. This is what makes recall useful months later.

**Example:** A tech spec uploaded with the context *"v2 auth design — chosen after Claude suggested JWT over session tokens, validated against competitor analysis"* gives Budda far richer recall than the spec content alone.

---

## 3. Scope Boundaries

Budda has a focused purpose. The following are explicitly out of scope.

| Budda Is NOT              | Reason                                                          |
|---------------------------|-----------------------------------------------------------------|
| A project management tool | Does not track sprints, tickets, or deadlines                   |
| A document editor         | Does not create or edit files — it remembers them               |
| A collaboration tool      | Personal product memory (team features are future scope)        |
| A web browser             | Only knows what the PM has fed it                               |
| A content generator       | Does not fabricate answers — only recalls what exists           |

---

## 4. Core User Flow

The typical workflow for a PM using Budda follows this pattern:

1. PM creates a new product workspace in Budda.
2. Throughout the product lifecycle, PM feeds Budda with relevant artifacts — PRDs, designs, research, AI chat outputs, links, images, and Drive documents.
3. For each entry, PM writes a brief context note explaining its relevance.
4. Budda reads, processes, and stores all content with source tags, types, and context.
5. When the PM (or a team member) needs to recall information — days, weeks, or months later — they open Ask Budda and ask questions in natural language.
6. Budda searches all stored memories and returns answers with references to specific documents and original links.
7. If documents have changed since last review, Budda flags the changes proactively.

---

## 5. Information Architecture

### 5.1 Data Model

Each product workspace contains entries. Each entry has the following attributes:

| Field   | Required    | Description                                                                                              |
|---------|-------------|----------------------------------------------------------------------------------------------------------|
| Title   | Yes         | Human-readable name of the entry                                                                         |
| Type    | Yes         | PRD, Research, Design, Tech Spec, Change Log, AI Chat, Link, Image, Meeting Notes, Spec, Other           |
| Content | Yes         | Full text content — extracted from files, pasted directly, or read from Drive                            |
| Source  | Yes         | Where it came from: Manual, Figma, ChatGPT, Claude, Perplexity, YouTube, Google Drive, Website, Image   |
| Context | Recommended | Human-written note explaining why this entry matters                                                     |
| Link    | No          | Original URL for external resources (auto-returned in Ask Budda)                                         |
| Date    | Auto        | When the entry was added                                                                                 |
| Status  | Auto        | Active by default                                                                                        |

### 5.2 Supported Input Types

| Input Mode   | Accepts                              | Processing                                           |
|--------------|--------------------------------------|------------------------------------------------------|
| Document     | PDF, DOCX, XLSX, PPTX, TXT, CSV      | AI-powered text extraction                           |
| Link         | Any URL                              | Auto-detection of platform + source tagging          |
| AI Chat      | Pasted text from any AI tool         | Source selection (ChatGPT / Claude / Perplexity)     |
| Image        | PNG, JPG, screenshots, photos        | AI vision extraction and description                 |
| Google Drive | Drive URLs                           | Full document read via Drive API + link storage      |

---

## 6. Future Roadmap

The following features are identified for future iterations beyond MVP, prioritized by impact.

### 6.1 P0 — Must Have Soon

- **Version diffing** — show what changed in a document between syncs, section by section
- **Slack bot integration** — allow team members to ask Budda questions directly from Slack
- **Cross-product search** — search across all products simultaneously ("find everything related to payments")

### 6.2 P1 — High Value

- Auto-capture from Slack channels and meeting transcripts
- Staleness alerts — flag documents that have not been updated in a specified period
- Team sharing — allow multiple PMs and team members to access the same product workspace
- Browser extension — clip content into Budda from any webpage with one click

### 6.3 P2 — Differentiator

- Product timeline and status board — visualize where each product is in its lifecycle
- Proactive insights — detect conflicts between documents, flag outdated specs
- Cross-product dependency mapping — when a decision in Product A impacts Product B
- Auto-suggested context — Budda recommends context notes based on document content

---

## 7. Success Metrics

The following metrics will determine whether Budda is delivering value to PMs.

| Metric                  | Target (MVP)                                                              | Measurement                 |
|-------------------------|---------------------------------------------------------------------------|-----------------------------|
| Products created per PM | 3+ within first month                                                     | Product count per user      |
| Entries fed per product | 10+ per active product                                                    | Entry count                 |
| Ask Budda usage         | 5+ questions per week                                                     | Chat message count          |
| Context gap resolved    | PM can answer product questions without searching Drive/Slack             | User interviews             |
| Time to context         | Under 30 seconds to find any product detail                               | Task completion time        |

---

## 8. Technical Notes (MVP)

### 8.1 Architecture

- **Frontend:** React single-page application
- **AI Backend:** Anthropic Claude API for text extraction, document reading, and Q&A
- **Storage:** Persistent key-value storage for cross-session data
- **Google Drive:** MCP integration for reading Drive documents
- **File Processing:** Client-side FileReader API for uploads, sent to Claude for extraction

### 8.2 AI Integration Points

| Feature              | AI Usage                                                          |
|----------------------|-------------------------------------------------------------------|
| Document Upload      | Claude extracts full text from PDFs and images                    |
| Google Drive Read    | Claude reads Drive files via MCP server integration               |
| Ask Budda            | Claude receives all product entries as context and answers questions |
| Image Processing     | Claude Vision describes uploaded images and extracts text         |

---

*🧘 Budda — Never lose context on any product, ever.*

*End of Document*
