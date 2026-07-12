# mediendAI Chatbot

AI-powered assistant for the Mediend CRM dashboard that can answer questions about data, analytics, and operations.

## Features

- **Natural Language Queries**: Ask questions about your dashboard data in plain English
- **Streaming Responses**: Real-time text streaming for smooth conversations
- **Tool Integration**: Leverages existing APIs and can execute raw SQL queries for complex analysis
- **Role-Based Access**: Respects user roles and permissions (BD sees own data, TEAM_LEAD sees team data, etc.)
- **Pre-made Questions**: Quick question chips for common queries
- **Beautiful UI**: Animated floating button with purple/white gradient theme

## Setup

### 1. Environment Variables

Add **one** of these to your `.env` file (OpenAI is used first if set):

**Option A – OpenAI (recommended)**  
Get a key at [OpenAI API Keys](https://platform.openai.com/api-keys):

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Optional: override the model (default is `gpt-4o-mini`):

```bash
OPENAI_CHAT_MODEL=gpt-4o
```

**Option B – Groq (free tier)**  
Get a key at [Groq Console](https://console.groq.com):

```bash
GROQ_API_KEY=your_groq_api_key_here
```

**Option C – Google Gemini**

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

Provider order: **OpenAI** → Groq → Google. If none are set, the chat returns a clear error.

### 2. Dependencies

Dependencies are already installed:
- `ai` - Vercel AI SDK
- `@ai-sdk/openai` - OpenAI provider (default when OPENAI_API_KEY is set)
- `@ai-sdk/google` - Google Gemini provider
- `@ai-sdk/groq` - Groq provider (free tier, multimodal)

## Architecture

### Backend

- **`/api/ai/chat`** - Main streaming chat endpoint
- **`/api/ai/sql`** - Secure raw SQL execution endpoint
- **`lib/ai/tools.ts`** - AI tool definitions (queryLeads, queryAnalytics, etc.)
- **`lib/ai/schema-context.ts`** - Database schema knowledge for AI
- **`lib/ai/sql-validator.ts`** - SQL query security validation

### Frontend

- **`components/ai/ai-floating-button.tsx`** - Animated gradient button
- **`components/ai/ai-chat-sheet.tsx`** - Chat sheet panel
- **`components/ai/message-list.tsx`** - Message display with streaming
- **`components/ai/chat-input.tsx`** - Input component
- **`components/ai/quick-questions.tsx`** - Pre-made question chips
- **`components/ai/ai-provider.tsx`** - Provider component

## Usage

1. Click the floating purple button in the bottom-right corner
2. The chat sheet opens from the right
3. Type your question or click a pre-made question chip
4. The AI responds with streaming text
5. Ask follow-up questions in the conversation

## Example Questions

- "What's the total revenue this month?"
- "Show me top performing BDs"
- "How many leads are in IPD stage?"
- "What's the conversion rate by source?"
- "List pending insurance cases"
- "Show outstanding payments summary"

## Security

- SQL queries are validated and restricted to SELECT statements only
- Role-based filtering ensures users only see data they have permission to access
- Query timeouts prevent long-running queries
- Row limits prevent excessive data retrieval

## AI Tools

The AI has access to these tools:

1. **queryLeads** - Query leads with filters (status, date range, circle, BD, etc.)
2. **queryAnalytics** - Get dashboard analytics (revenue, profit, conversion rates)
3. **queryFinance** - Query finance ledger entries
4. **executeQuery** - Execute raw SQL SELECT queries (for complex analysis)
5. **getSchemaInfo** - Get information about database tables and fields

## Customization

### Change Model

Edit `app/api/ai/chat/route.ts`:

```typescript
model: google('gemini-1.5-flash') // Change to gemini-1.5-pro for better quality
```

### Add More Quick Questions

Edit `components/ai/quick-questions.tsx`:


```typescript
const QUICK_QUESTIONS = [
  "Your question here",
  // ...
]
```

### Customize Colors

Edit `components/ai/ai-floating-button.tsx` and other components to change the purple theme.
