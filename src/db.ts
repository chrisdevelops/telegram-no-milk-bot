// src/db.ts
import Database from "better-sqlite3";
import * as fs from 'fs';
import { GroceryItem, ChatRecord, ItemWithPosition, SortMode, SortDirection } from "./lib/types";

let db: Database.Database;

/**
 * Initialize the SQLite database and create tables if they don't exist
 * @throws Error if database initialization fails
 */
export function initDb(): void {
  try {
    const dbPath = process.env.DB_PATH ?? "./grocery.db";
    db = new Database(dbPath);

    // Create chats table for tracking message IDs
    db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        chat_id INTEGER PRIMARY KEY,
        last_message_id INTEGER
      );
    `);

    // Create grocery_items table for storing list items
    db.exec(`
      CREATE TABLE IF NOT EXISTS grocery_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Add sort_order column if it doesn't exist (for positional insertion)
    try {
      db.exec(`
        ALTER TABLE grocery_items
        ADD COLUMN sort_order INTEGER DEFAULT 0;
      `);
      console.log("Added sort_order column to grocery_items table");
    } catch (error) {
      // Column might already exist, which is fine
    }

    // Backfill sort_order for existing items (use id as initial sort_order)
    db.exec(`
      UPDATE grocery_items
      SET sort_order = id
      WHERE sort_order = 0 OR sort_order IS NULL;
    `);

    // Add created_at column if it doesn't exist (for date-based sorting)
    try {
      db.exec(`
        ALTER TABLE grocery_items
        ADD COLUMN created_at INTEGER;
      `);
      console.log("Added created_at column to grocery_items table");

      // Backfill created_at for all existing items with current timestamp
      db.exec(`
        UPDATE grocery_items
        SET created_at = strftime('%s', 'now')
        WHERE created_at IS NULL;
      `);
      console.log("Backfilled created_at timestamps for existing items");
    } catch (error) {
      // Column might already exist, which is fine
    }

    // Add sort_mode column to chats table
    let sortModeAdded = false;
    try {
      db.exec(`
        ALTER TABLE chats ADD COLUMN sort_mode TEXT DEFAULT 'date';
      `);
      console.log("Added sort_mode column to chats table");
      sortModeAdded = true;
    } catch (error) {
      // Column might already exist
    }

    // Add sort_direction column to chats table
    let sortDirectionAdded = false;
    try {
      db.exec(`
        ALTER TABLE chats ADD COLUMN sort_direction TEXT DEFAULT 'asc';
      `);
      console.log("Added sort_direction column to chats table");
      sortDirectionAdded = true;
    } catch (error) {
      // Column might already exist
    }

    // Backfill sort preferences for existing chats (only if columns were just added)
    if (sortModeAdded || sortDirectionAdded) {
      try {
        db.exec(`
          UPDATE chats
          SET sort_mode = COALESCE(sort_mode, 'date'),
              sort_direction = COALESCE(sort_direction, 'asc')
          WHERE sort_mode IS NULL OR sort_direction IS NULL;
        `);
        console.log("Backfilled sort preferences for existing chats");
      } catch (error) {
        console.warn("Failed to backfill sort preferences:", error);
      }
    }

    // Create history table for command tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        command TEXT NOT NULL,
        items TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Create index for efficient pagination queries
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_history_chat_timestamp
        ON history(chat_id, timestamp DESC);
      `);
      console.log("Created index on history table");
    } catch (error) {
      // Index might already exist
    }

    console.log(`Database initialized at ${dbPath}`);
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw new Error("Database initialization failed");
  }
}

/**
 * Close the database connection gracefully
 */
export function closeDb(): void {
  try {
    if (db) {
      db.close();
      console.log("Database connection closed");
    }
  } catch (error) {
    console.error("Error closing database:", error);
  }
}

/**
 * Get or create a chat record from the database
 * @param chatId - The Telegram chat ID
 * @returns ChatRecord with chat ID, last message ID, and sort preferences
 * @throws Error if database operation fails
 */
export function getChatRecord(chatId: number): ChatRecord {
  try {
    const row = db
      .prepare(`
        SELECT chat_id, last_message_id, sort_mode, sort_direction
        FROM chats
        WHERE chat_id = ?
      `)
      .get(chatId) as {
        chat_id: number;
        last_message_id: number | null;
        sort_mode: string;
        sort_direction: string;
      } | undefined;

    if (!row) {
      // Create new chat record with default sort preferences
      db.prepare(`
        INSERT INTO chats (chat_id, last_message_id, sort_mode, sort_direction)
        VALUES (?, NULL, 'date', 'asc')
      `).run(chatId);

      return {
        chatId,
        lastMessageId: null,
        sortMode: 'date',
        sortDirection: 'asc'
      };
    }

    return {
      chatId: row.chat_id,
      lastMessageId: row.last_message_id,
      sortMode: row.sort_mode as SortMode,
      sortDirection: row.sort_direction as SortDirection,
    };
  } catch (error) {
    console.error(`Failed to get chat record for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not retrieve chat record`);
  }
}

/**
 * Update the last message ID for a chat
 * @param chatId - The Telegram chat ID
 * @param messageId - The message ID to store
 * @throws Error if database operation fails
 */
export function setLastMessageId(chatId: number, messageId: number): void {
  try {
    db.prepare(
      `INSERT INTO chats (chat_id, last_message_id)
       VALUES (?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET last_message_id = excluded.last_message_id`
    ).run(chatId, messageId);
  } catch (error) {
    console.error(`Failed to set last message ID for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not update last message ID`);
  }
}

/**
 * Update sort preferences for a chat
 * @param chatId - The Telegram chat ID
 * @param mode - Sort mode (manual, name, or date)
 * @param direction - Sort direction (asc or desc)
 * @throws Error if database operation fails
 */
export function setSortPreferences(
  chatId: number,
  mode: SortMode,
  direction: SortDirection
): void {
  try {
    db.prepare(`
      INSERT INTO chats (chat_id, last_message_id, sort_mode, sort_direction)
      VALUES (?, NULL, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        sort_mode = excluded.sort_mode,
        sort_direction = excluded.sort_direction
    `).run(chatId, mode, direction);

    console.log(`[DEBUG] Set sort preferences for chat ${chatId}: ${mode} ${direction}`);
  } catch (error) {
    console.error(`Failed to set sort preferences for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not update sort preferences`);
  }
}

/**
 * Get all grocery items for a chat, sorted according to chat preferences
 * @param chatId - The Telegram chat ID
 * @returns Array of grocery items, sorted according to chat's sort_mode and sort_direction
 * @throws Error if database operation fails
 */
export function getItems(chatId: number): GroceryItem[] {
  try {
    // Get chat's sort preferences
    const chat = getChatRecord(chatId);
    const { sortMode, sortDirection } = chat;

    // Build ORDER BY clause based on sort mode
    let orderByClause: string;

    if (sortMode === 'manual') {
      // Manual mode always ascending (ignores direction)
      orderByClause = 'sort_order ASC';
    } else if (sortMode === 'name') {
      orderByClause = `LOWER(name) ${sortDirection.toUpperCase()}`;
    } else if (sortMode === 'date') {
      orderByClause = `created_at ${sortDirection.toUpperCase()}`;
    } else {
      // Fallback to date ascending
      orderByClause = 'created_at ASC';
    }

    const rows = db
      .prepare(`
        SELECT id, name, checked
        FROM grocery_items
        WHERE chat_id = ?
        ORDER BY ${orderByClause}
      `)
      .all(chatId) as { id: number; name: string; checked: number }[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      checked: !!row.checked,
    }));
  } catch (error) {
    console.error(`Failed to get items for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not retrieve grocery items`);
  }
}

/**
 * Add new items to a chat's grocery list (case-insensitive duplicate prevention)
 * @param chatId - The Telegram chat ID
 * @param names - Array of item names to add
 * @throws Error if database operation fails
 */
export function addItems(chatId: number, names: string[]): void {
  // Convert to ItemWithPosition format (no positions)
  const itemsWithPos: ItemWithPosition[] = names.map(name => ({ name, position: null }));
  addItemsWithPosition(chatId, itemsWithPos);
}

/**
 * Add new items to a chat's grocery list with optional positional control
 * Supports @position syntax: pears@3, milk, apples@1
 * @param chatId - The Telegram chat ID
 * @param items - Array of items with optional positions
 * @throws Error if database operation fails
 */
export function addItemsWithPosition(chatId: number, items: ItemWithPosition[]): void {
  try {
    const existing = getItems(chatId);
    const existingNorm = new Set(existing.map((item) => item.name.trim().toLowerCase()));
    const currentCount = existing.length;

    // Filter out duplicates and track what we're adding
    const itemsToAdd: ItemWithPosition[] = [];
    for (const item of items) {
      const normalized = item.name.trim().toLowerCase();
      if (!existingNorm.has(normalized)) {
        itemsToAdd.push(item);
        existingNorm.add(normalized);
      }
    }

    if (itemsToAdd.length === 0) {
      return; // Nothing to add
    }

    // Calculate max sort_order
    const maxSortOrder = existing.length > 0
      ? Math.max(...existing.map((_, idx) => idx + 1))
      : 0;

    // Resolve positions (handle duplicates, clamping, etc.)
    const usedPositions = new Set<number>();
    const resolved = new Map<string, number>();

    // Process items with explicit positions first
    for (const item of itemsToAdd) {
      if (item.position !== null) {
        // Clamp to valid range (1 to currentCount + addedSoFar + 1)
        let targetPos = Math.max(1, Math.min(item.position, currentCount + itemsToAdd.length));

        // If position already used in this batch, append to end instead
        if (usedPositions.has(targetPos)) {
          resolved.set(item.name, -1); // Mark for append
        } else {
          usedPositions.add(targetPos);
          resolved.set(item.name, targetPos);
        }
      } else {
        resolved.set(item.name, -1); // Mark for append
      }
    }

    // Calculate next append position
    let nextAppendPos = currentCount + usedPositions.size + 1;

    // Shift existing items' sort_order to make room for positioned items
    const sortedPositions = Array.from(usedPositions).sort((a, b) => a - b);
    for (const pos of sortedPositions) {
      // Shift items at position >= pos up by 1
      db.prepare(
        "UPDATE grocery_items SET sort_order = sort_order + 1 WHERE chat_id = ? AND sort_order >= ?"
      ).run(chatId, pos);
    }

    // Insert new items
    const insertStmt = db.prepare(
      "INSERT INTO grocery_items (chat_id, name, checked, sort_order, created_at) VALUES (?, ?, 0, ?, strftime('%s', 'now'))"
    );

    for (const item of itemsToAdd) {
      const targetPos = resolved.get(item.name);

      if (targetPos === -1) {
        // Append to end
        insertStmt.run(chatId, item.name.trim(), nextAppendPos++);
      } else if (targetPos !== undefined) {
        // Insert at specific position
        insertStmt.run(chatId, item.name.trim(), targetPos);
      }
    }

    console.log(`[DEBUG] Added ${itemsToAdd.length} items to chat ${chatId} with positions`);
  } catch (error) {
    console.error(`Failed to add items with positions for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not add grocery items`);
  }
}

/**
 * Remove items from a chat's grocery list (case-insensitive matching)
 * @param chatId - The Telegram chat ID
 * @param names - Array of item names to remove
 * @throws Error if database operation fails
 */
export function removeItems(chatId: number, names: string[]): void {
  try {
    const toRemoveNormalized = names.map((name) => name.trim().toLowerCase());
    const items = getItems(chatId);
    const deleteStmt = db.prepare("DELETE FROM grocery_items WHERE id = ?");

    for (const item of items) {
      const normalized = item.name.trim().toLowerCase();
      if (toRemoveNormalized.includes(normalized)) {
        deleteStmt.run(item.id);
      }
    }
  } catch (error) {
    console.error(`Failed to remove items for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not remove grocery items`);
  }
}

/**
 * Toggle checked state of items in a chat's grocery list (case-insensitive matching)
 * If an item is checked, it will be unchecked, and vice versa
 * @param chatId - The Telegram chat ID
 * @param names - Array of item names to toggle
 * @throws Error if database operation fails
 */
export function checkItems(chatId: number, names: string[]): void {
  try {
    const toToggleNormalized = names.map((name) => name.trim().toLowerCase());
    const items = getItems(chatId);
    const updateStmt = db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?");

    console.log(`[DEBUG] checkItems (toggle) called for chat ${chatId}`);
    console.log(`[DEBUG] Items to toggle:`, toToggleNormalized);
    console.log(`[DEBUG] Current items:`, items.map(i => ({ name: i.name, checked: i.checked })));

    let toggledCount = 0;
    for (const item of items) {
      const normalized = item.name.trim().toLowerCase();
      if (toToggleNormalized.includes(normalized)) {
        // Toggle: if checked, uncheck (0); if unchecked, check (1)
        const newCheckedValue = item.checked ? 0 : 1;
        console.log(`[DEBUG] Toggling item: ${item.name} (id: ${item.id}) from ${item.checked} to ${!!newCheckedValue}`);
        const result = updateStmt.run(newCheckedValue, item.id);
        console.log(`[DEBUG] Update result:`, result);
        toggledCount++;
      }
    }
    console.log(`[DEBUG] Toggled ${toggledCount} items`);
  } catch (error) {
    console.error(`Failed to toggle items for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not toggle grocery items`);
  }
}

/**
 * Clear all items from a chat's grocery list
 * @param chatId - The Telegram chat ID
 * @throws Error if database operation fails
 */
export function clearItems(chatId: number): void {
  try {
    db.prepare("DELETE FROM grocery_items WHERE chat_id = ?").run(chatId);
  } catch (error) {
    console.error(`Failed to clear items for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not clear grocery items`);
  }
}

/**
 * Get the size of the database file
 * @returns Size in bytes, or null if file doesn't exist
 * @throws Never throws - returns null on error
 */
export function getDatabaseSize(): number | null {
  try {
    const dbPath = process.env.DB_PATH ?? "./grocery.db";
    const stats = fs.statSync(dbPath);
    return stats.size;
  } catch (error) {
    console.error("Failed to get database size:", error);
    return null;
  }
}

/**
 * Get all grocery items with debug information
 * Returns items sorted by database ID (insertion order) for debugging
 * @param chatId - The Telegram chat ID
 * @returns Array of items with extended debug fields
 * @throws Error if database operation fails
 */
export function getItemsWithDebugInfo(chatId: number): Array<{
  id: number;
  name: string;
  checked: boolean;
  sortOrder: number;
  createdAt: number;
}> {
  try {
    const rows = db
      .prepare(`
        SELECT id, name, checked, sort_order, created_at
        FROM grocery_items
        WHERE chat_id = ?
        ORDER BY id ASC
      `)
      .all(chatId) as Array<{
        id: number;
        name: string;
        checked: number;
        sort_order: number;
        created_at: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      checked: !!row.checked,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error(`Failed to get debug info for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not retrieve debug information`);
  }
}

/**
 * History entry data structure
 */
export interface HistoryEntry {
  id?: number;
  chatId: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  command: string;
  items: string;
  timestamp?: number;
}

/**
 * Add a new history entry with FIFO deletion if max is reached
 * @param entry - History entry data
 * @throws Error if database operation fails
 */
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  try {
    const { getHistoryConfig } = require('./lib/config');
    const config = getHistoryConfig();

    // Check if we need to delete old entries (FIFO)
    if (config.maxEntries > 0) {
      const countRow = db
        .prepare('SELECT COUNT(*) as count FROM history WHERE chat_id = ?')
        .get(entry.chatId) as { count: number } | undefined;

      const count = countRow?.count ?? 0;

      if (count >= config.maxEntries) {
        // Delete oldest entries to make room
        const toDelete = count - config.maxEntries + 1;
        db.prepare(`
          DELETE FROM history
          WHERE chat_id = ?
          AND id IN (
            SELECT id FROM history
            WHERE chat_id = ?
            ORDER BY timestamp ASC
            LIMIT ?
          )
        `).run(entry.chatId, entry.chatId, toDelete);

        console.log(`[HISTORY] Deleted ${toDelete} old entries for chat ${entry.chatId}`);
      }
    }

    // Insert new entry
    db.prepare(`
      INSERT INTO history (chat_id, user_id, username, first_name, last_name, command, items, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `).run(
      entry.chatId,
      entry.userId,
      entry.username,
      entry.firstName,
      entry.lastName,
      entry.command,
      entry.items
    );
  } catch (error) {
    console.error(`Failed to add history entry for chat ${entry.chatId}:`, error);
    throw new Error(`Database error: Could not add history entry`);
  }
}

/**
 * Get paginated history for a chat
 * @param chatId - The Telegram chat ID
 * @param page - Page number (1-indexed)
 * @param perPage - Entries per page (default: 10)
 * @returns Object with entries array and pagination info
 * @throws Error if database operation fails
 */
export function getHistoryPage(
  chatId: number,
  page: number = 1,
  perPage: number = 10
): {
  entries: HistoryEntry[];
  totalEntries: number;
  totalPages: number;
  currentPage: number;
} {
  try {
    // Get total count
    const countRow = db
      .prepare('SELECT COUNT(*) as count FROM history WHERE chat_id = ?')
      .get(chatId) as { count: number } | undefined;

    const totalEntries = countRow?.count ?? 0;
    const totalPages = Math.ceil(totalEntries / perPage) || 1;

    // Clamp page to valid range
    const currentPage = Math.max(1, Math.min(page, totalPages));

    // Calculate offset
    const offset = (currentPage - 1) * perPage;

    // Fetch entries (most recent first)
    const rows = db
      .prepare(`
        SELECT id, chat_id, user_id, username, first_name, last_name, command, items, timestamp
        FROM history
        WHERE chat_id = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `)
      .all(chatId, perPage, offset) as Array<{
        id: number;
        chat_id: number;
        user_id: number;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        command: string;
        items: string;
        timestamp: number;
      }>;

    const entries: HistoryEntry[] = rows.map(row => ({
      id: row.id,
      chatId: row.chat_id,
      userId: row.user_id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      command: row.command,
      items: row.items,
      timestamp: row.timestamp,
    }));

    return {
      entries,
      totalEntries,
      totalPages,
      currentPage,
    };
  } catch (error) {
    console.error(`Failed to get history for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not retrieve history`);
  }
}
