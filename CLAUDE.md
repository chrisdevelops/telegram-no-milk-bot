# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production build
npm start
```

## Environment Setup

Create a `.env` file with:
```
BOT_TOKEN=your_telegram_bot_token
DB_PATH=./grocery.db  # optional, defaults to ./grocery.db
```

## Architecture Overview

This is a Telegram bot that manages per-chat grocery lists using Grammy (Telegram bot framework) and better-sqlite3 for persistence.

### Core Design Pattern: Delete and Recreate Messages

The bot **deletes the previous grocery list message and sends a new one** on every update. This ensures the list always appears at the bottom of the chat and users see the most recent state.

**Implementation** (src/lib/render.ts:33):
1. Delete the old message using `ctx.api.deleteMessage()` (ignores errors if message already deleted)
2. Send a new message with updated list using `ctx.api.sendMessage()`
3. Store the new message ID in the database for next update

**State Tracking**:
- `GroceryListState` (src/lib/types.ts:16) contains `chatId`, `items`, and `lastMessageId`
- The `chats` table stores `last_message_id` to track which message to delete

### Type Safety

The codebase uses TypeScript with strict mode enabled:
- `BotContext` type (src/lib/types.ts:34) extends Grammy's `Context`
- All database functions have proper return types and parameter types
- Command handlers use typed parameters with `Promise<void>` return types
- Interfaces are used for data structures (`GroceryItem`, `GroceryListState`, `ChatRecord`)

### Error Handling

Follows Grammy best practices:
- **Global error handler** (src/main.ts:49): Uses `bot.catch()` to handle `GrammyError`, `HttpError`, and unknown errors
- **Try-catch blocks**: All database operations wrapped in try-catch with descriptive error messages
- **Graceful degradation**: Message deletion errors are logged but don't stop execution
- **User-friendly errors**: Commands show clear error messages with examples when validation fails

### Database Schema

Two tables in SQLite (src/db.ts):
- `chats`: Tracks `chat_id` and `last_message_id` for message deletion
- `grocery_items`: Stores items with `id`, `chat_id`, `name`, and `checked` (0/1 boolean)

All database functions:
- Include JSDoc comments describing parameters and return types
- Throw descriptive errors on failure
- Use prepared statements to prevent SQL injection
- Log errors to console before throwing

### Command Architecture

Commands follow a consistent pattern (src/commands/grocery/):
1. **Parse**: Extract command and arguments using `parseItems()` (splits by comma)
2. **Build State**: Use `makeState()` to fetch current items and message ID from database
3. **Execute**: Call database operation (add, remove, check, clear)
4. **Refresh**: Re-fetch items to get updated state
5. **Update UI**: Call `updateListMessage()` to delete old message and send new one

All subcommands have:
- Proper TypeScript types with `BotContext` and `GroceryListState`
- Input validation with user-friendly error messages
- Async/await throughout (no floating promises)

### Item Matching

Database operations use **case-insensitive, normalized matching**:
- Convert to lowercase and trim whitespace
- Compare normalized versions to prevent duplicates
- Preserves original capitalization when storing items

### Entry Point (src/main.ts)

Initialization order:
1. Load environment variables with dotenv
2. Initialize database with error handling
3. Validate BOT_TOKEN exists
4. Create bot instance with `BotContext` type
5. Register `/start` and `/grocery` commands
6. Install error handler with `bot.catch()`
7. Set up graceful shutdown handlers (SIGINT/SIGTERM)
8. Start bot with promise error handling

The bot properly awaits `bot.stop()` on shutdown and closes database connection.
