// src/lib/types.ts
import { Context } from "grammy";

/**
 * Represents a single grocery item in the list
 */
export interface GroceryItem {
  id: number;
  name: string;
  checked: boolean;
}

/**
 * State object containing grocery list data for a chat
 */
export interface GroceryListState {
  chatId: number;
  items: GroceryItem[];
  lastMessageId: number | null;
}

/**
 * Database record for a chat
 */
export interface ChatRecord {
  chatId: number;
  lastMessageId: number | null;
}

/**
 * Custom context type for the bot
 * Extends Grammy's Context with type safety
 */
export type BotContext = Context;
