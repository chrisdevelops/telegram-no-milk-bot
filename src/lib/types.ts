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
  sortMode: SortMode;
  sortDirection: SortDirection;
}

/**
 * Database record for a chat
 */
export interface ChatRecord {
  chatId: number;
  lastMessageId: number | null;
  sortMode: SortMode;
  sortDirection: SortDirection;
}

/**
 * Item with optional position for insertion
 */
export interface ItemWithPosition {
  name: string;
  position: number | null;
}

/**
 * Sort mode for grocery list display
 */
export type SortMode = 'manual' | 'name' | 'date';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort preferences for a chat
 */
export interface SortPreferences {
  mode: SortMode;
  direction: SortDirection;
}

/**
 * Custom context type for the bot
 * Extends Grammy's Context with type safety
 */
export type BotContext = Context;
