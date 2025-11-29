// src/commands/grocery/index.ts
import { Bot } from "grammy";
import { getChatRecord, getItems } from "../../db";
import { BotContext, GroceryListState } from "../../lib/types";
import { handleShow } from "./show";
import { handleAdd } from "./add";
import { handleRemove } from "./remove";
import { handleCheck } from "./check";
import { handleClear } from "./clear";
import { handleCopy } from "./copy";

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
 * Parse natural language command from text
 * Extracts command verb and items text from messages containing "grocery" or "groceries"
 * @param text - The full message text
 * @returns Object with command and itemsText (empty string if no command found)
 */
export function parseNaturalLanguageCommand(text: string): {
  command: string;
  itemsText: string;
} {
  const pattern = /\b(?:grocery|groceries)\b\s*(?:(add|create|\+|remove|rm|-|check|mark|x|clear|reset|show|list|copy))?\s*(.*)/i;
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
 * @returns GroceryListState with current items and last message ID
 */
export function makeState(chatId: number): GroceryListState {
  const chat = getChatRecord(chatId);
  const items = getItems(chatId);
  return {
    chatId,
    items,
    lastMessageId: chat.lastMessageId,
  };
}

/**
 * Register natural language grocery command handler
 * Responds to messages containing "grocery" or "groceries"
 * @param bot - The Grammy bot instance
 */
export function registerNaturalLanguageGrocery(bot: Bot<BotContext>): void {
  bot.hears(/\b(?:grocery|groceries)\b/i, async (ctx) => {
    const chatId = ctx.chat?.id;
    const text = ctx.message?.text ?? "";

    if (!chatId) {
      console.error("No chat ID available in context");
      return;
    }

    try {
      const { command, itemsText } = parseNaturalLanguageCommand(text);
      const items = parseItems(itemsText);
      const state = makeState(chatId);

      console.log(`[DEBUG] Natural language command: "${command}", Items text: "${itemsText}", Parsed items:`, items);

      // If no valid command was found, silently ignore (allows normal conversation)
      if (!command) {
        console.log(`[DEBUG] No command found, ignoring message`);
        return;
      }

      // Normalize command aliases (create → add, rm → remove, etc.)
      const normalizedCommand = normalizeCommand(command);

      switch (normalizedCommand) {
        case "add":
          await handleAdd(ctx, state, items);
          break;
        case "remove":
          await handleRemove(ctx, state, items);
          break;
        case "check":
          await handleCheck(ctx, state, items);
          break;
        case "clear":
          await handleClear(ctx, state);
          break;
        case "show":
          await handleShow(ctx, state);
          break;
        case "copy":
          await handleCopy(ctx, state);
          break;
        default:
          // Unknown command after normalization - show help
          await ctx.reply(
            "❓ Unknown command. Try:\n" +
            "grocery show, add, remove, check, copy, or clear"
          );
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
