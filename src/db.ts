// src/db.ts
import Database from "better-sqlite3";
import { GroceryItem, ChatRecord } from "./lib/types";

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
 * @returns ChatRecord with chat ID and last message ID
 * @throws Error if database operation fails
 */
export function getChatRecord(chatId: number): ChatRecord {
  try {
    const row = db
      .prepare("SELECT chat_id, last_message_id FROM chats WHERE chat_id = ?")
      .get(chatId) as { chat_id: number; last_message_id: number | null } | undefined;

    if (!row) {
      // Create new chat record if it doesn't exist
      db.prepare("INSERT INTO chats (chat_id, last_message_id) VALUES (?, NULL)").run(chatId);
      return { chatId, lastMessageId: null };
    }

    return {
      chatId: row.chat_id,
      lastMessageId: row.last_message_id,
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
 * Get all grocery items for a chat
 * @param chatId - The Telegram chat ID
 * @returns Array of grocery items
 * @throws Error if database operation fails
 */
export function getItems(chatId: number): GroceryItem[] {
  try {
    const rows = db
      .prepare("SELECT id, name, checked FROM grocery_items WHERE chat_id = ? ORDER BY id ASC")
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
  try {
    const existing = getItems(chatId);
    const existingNorm = new Set(existing.map((item) => item.name.trim().toLowerCase()));

    const insert = db.prepare(
      "INSERT INTO grocery_items (chat_id, name, checked) VALUES (?, ?, 0)"
    );

    for (const itemName of names) {
      const normalized = itemName.trim().toLowerCase();
      if (!existingNorm.has(normalized)) {
        insert.run(chatId, itemName.trim());
        existingNorm.add(normalized);
      }
    }
  } catch (error) {
    console.error(`Failed to add items for chat ${chatId}:`, error);
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
 * Mark items as checked in a chat's grocery list (case-insensitive matching)
 * @param chatId - The Telegram chat ID
 * @param names - Array of item names to check off
 * @throws Error if database operation fails
 */
export function checkItems(chatId: number, names: string[]): void {
  try {
    const toCheckNormalized = names.map((name) => name.trim().toLowerCase());
    const items = getItems(chatId);
    const updateStmt = db.prepare("UPDATE grocery_items SET checked = 1 WHERE id = ?");

    console.log(`[DEBUG] checkItems called for chat ${chatId}`);
    console.log(`[DEBUG] Items to check:`, toCheckNormalized);
    console.log(`[DEBUG] Current items:`, items.map(i => ({ name: i.name, checked: i.checked })));

    let checkedCount = 0;
    for (const item of items) {
      const normalized = item.name.trim().toLowerCase();
      if (toCheckNormalized.includes(normalized) && !item.checked) {
        console.log(`[DEBUG] Checking item: ${item.name} (id: ${item.id})`);
        const result = updateStmt.run(item.id);
        console.log(`[DEBUG] Update result:`, result);
        checkedCount++;
      } else if (toCheckNormalized.includes(normalized) && item.checked) {
        console.log(`[DEBUG] Item ${item.name} is already checked`);
      }
    }
    console.log(`[DEBUG] Checked ${checkedCount} items`);
  } catch (error) {
    console.error(`Failed to check items for chat ${chatId}:`, error);
    throw new Error(`Database error: Could not check grocery items`);
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
