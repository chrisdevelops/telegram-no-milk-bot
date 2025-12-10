// src/commands/grocery/index.ts
import { Bot } from "grammy";
import { getChatRecord, getItems } from "../../db";
import { BotContext, GroceryListState, ItemWithPosition } from "../../lib/types";
import { handleShow } from "./show";
import { handleAdd } from "./add";
import { handleRemove } from "./remove";
import { handleCheck } from "./check";
import { handleClear } from "./clear";
import { handleCopy } from "./copy";
import { handleSort } from "./sort";
import { handleDebug } from "./debug";
import { handleHelp } from "./help";
import { handleHistory } from "./history";

/**
 * Parse comma-separated items from text input
 * @param text - The text containing comma-separated items
 * @returns Array of trimmed, non-empty item names
 */
export function parseItems(text: string): string[] {
  const MAX_ITEM_LENGTH = 200;

  if (!text || text.trim().length === 0) {
    return [];
  }

  return text
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length <= MAX_ITEM_LENGTH)
    .map(item => item.substring(0, MAX_ITEM_LENGTH));
}

/**
 * Parse comma-separated items with optional @position syntax
 * Supports flexible spacing: "item@3", "item @ 3", "item @3"
 * @param text - The text containing items (e.g., "pears@3, milk, apples @2")
 * @returns Array of items with optional positions
 */
export function parseItemsWithPosition(text: string): ItemWithPosition[] {
  const MAX_ITEM_LENGTH = 200;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const items: ItemWithPosition[] = [];
  const parts = text.split(',');

  for (const part of parts) {
    const trimmed = part.trim();

    // Match: "itemName @position" or "itemName@position" or "itemName @ position"
    // Flexible spacing around @ symbol
    const match = trimmed.match(/^(.+?)\s*@\s*(\d+)$/);

    if (match) {
      const name = match[1].trim();
      const position = parseInt(match[2], 10);

      if (name.length > 0 && name.length <= MAX_ITEM_LENGTH) {
        items.push({
          name: name.substring(0, MAX_ITEM_LENGTH),
          position
        });
      }
    } else {
      // No position specified - will append to end
      if (trimmed.length > 0 && trimmed.length <= MAX_ITEM_LENGTH) {
        items.push({
          name: trimmed.substring(0, MAX_ITEM_LENGTH),
          position: null
        });
      }
    }
  }

  return items;
}

/**
 * Parse natural language command from text
 * Extracts command verb and items text from messages containing "grocery" or "groceries"
 * @param text - The full message text
 * @returns Object with command and itemsText (empty string if no command found)
 */
export function parseNaturalLanguageCommand(text: string): {
  command: string;
  itemsText: string;
} {
  const pattern = /\b(?:grocery|groceries)\b\s*(?:(add|create|\+|remove|rm|-|check|mark|x|clear|reset|show|list|copy|sort|debug|help|history))?\s*(.*)/i;
  const match = text.match(pattern);

  if (!match) {
    return { command: '', itemsText: '' };
  }

  const command = match[1]?.toLowerCase() || '';
  const itemsText = match[2]?.trim() || '';

  return { command, itemsText };
}

/**
 * Normalize command aliases to standard command names
 * @param cmd - The command to normalize
 * @returns Standard command name (add, remove, check, clear, show)
 */
export function normalizeCommand(cmd: string): string {
  const aliases: Record<string, string> = {
    'create': 'add',
    '+': 'add',
    'rm': 'remove',
    '-': 'remove',
    'mark': 'check',
    'x': 'check',
    'list': 'show',
    'reset': 'clear'
  };
  return aliases[cmd] || cmd;
}

/**
 * Create a grocery list state object for a chat
 * @param chatId - The Telegram chat ID
 * @returns GroceryListState with current items, last message ID, and sort preferences
 */
export function makeState(chatId: number): GroceryListState {
  const chat = getChatRecord(chatId);
  const items = getItems(chatId);
  return {
    chatId,
    items,
    lastMessageId: chat.lastMessageId,
    sortMode: chat.sortMode,
    sortDirection: chat.sortDirection,
  };
}

/**
 * Register natural language grocery command handler
 * Responds to messages containing "grocery" or "groceries"
 * @param bot - The Grammy bot instance
 */
export function registerNaturalLanguageGrocery(bot: Bot<BotContext>): void {
  // Read feature flag from environment
  const shouldDeleteCommandMessages = process.env.DELETE_COMMAND_MESSAGES === 'true';

  bot.hears(/\b(?:grocery|groceries)\b/i, async (ctx) => {
    const chatId = ctx.chat?.id;
    const text = ctx.message?.text ?? "";
    const messageId = ctx.message?.message_id;

    if (!chatId) {
      console.error("No chat ID available in context");
      return;
    }

    try {
      const { command, itemsText } = parseNaturalLanguageCommand(text);
      const state = makeState(chatId);

      console.log(`[DEBUG] Natural language command: "${command}", Items text: "${itemsText}"`);

      // If no valid command was found, silently ignore (allows normal conversation)
      if (!command) {
        console.log(`[DEBUG] No command found, ignoring message`);
        return;
      }

      // Normalize command aliases (create → add, rm → remove, etc.)
      const normalizedCommand = normalizeCommand(command);

      // Track if command was successfully executed
      let commandExecuted = false;

      switch (normalizedCommand) {
        case "add":
          // Use position-aware parsing for add command
          const itemsWithPos = parseItemsWithPosition(itemsText);
          console.log(`[DEBUG] Parsed items with positions:`, itemsWithPos);
          await handleAdd(ctx, state, itemsWithPos);
          commandExecuted = true;
          break;
        case "remove":
          const removeItems = parseItems(itemsText);
          await handleRemove(ctx, state, removeItems);
          commandExecuted = true;
          break;
        case "check":
          const checkItems = parseItems(itemsText);
          await handleCheck(ctx, state, checkItems);
          commandExecuted = true;
          break;
        case "clear":
          await handleClear(ctx, state);
          commandExecuted = true;
          break;
        case "show":
          await handleShow(ctx, state);
          commandExecuted = true;
          break;
        case "copy":
          await handleCopy(ctx, state);
          commandExecuted = true;
          break;
        case "sort":
          await handleSort(ctx, state, itemsText);
          commandExecuted = true;
          break;
        case "debug":
          await handleDebug(ctx, state);
          commandExecuted = true;
          break;
        case "help":
          await handleHelp(ctx, state);
          commandExecuted = true;
          break;
        case "history":
          await handleHistory(ctx, itemsText);
          commandExecuted = true;
          break;
        default:
          // Unknown command after normalization - show help
          await ctx.reply(
            "❓ Unknown command. Try 'grocery help' for a list of commands."
          );
      }

      // Delete the user's command message if feature is enabled and command was executed
      if (shouldDeleteCommandMessages && commandExecuted && messageId) {
        try {
          await ctx.deleteMessage();
          console.log(`[DEBUG] Deleted command message ${messageId} from chat ${chatId}`);
        } catch (error) {
          // Silently fail - bot might not have delete permissions or message might be too old
          console.warn(`[WARN] Could not delete command message ${messageId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error handling grocery command in chat ${chatId}:`, error);
      await ctx.reply(
        "❌ Sorry, something went wrong. Please try again later."
      ).catch((err) => {
        console.error("Failed to send error message:", err);
      });
    }
  });
}
