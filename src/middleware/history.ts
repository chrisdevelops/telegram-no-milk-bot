// src/middleware/history.ts
import { BotContext } from "../lib/types";
import { addHistoryEntry } from "../db";
import { parseNaturalLanguageCommand, normalizeCommand } from "../commands/grocery";
import { getHistoryConfig } from "../lib/config";

/**
 * Commands that should NOT be tracked in history
 */
const EXCLUDED_COMMANDS = new Set(['history', 'help', 'debug']);

/**
 * Grammy middleware to track command history
 * Must be installed before command handlers
 */
export async function historyTrackingMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  // Always call next() first to let the command execute
  await next();

  // Only track if history is enabled
  const config = getHistoryConfig();
  if (!config.enabled) {
    return;
  }

  // Only track messages (not callbacks, edits, etc.)
  if (!ctx.message?.text) {
    return;
  }

  // Only track messages containing "grocery" or "groceries"
  const text = ctx.message.text;
  if (!/\b(?:grocery|groceries)\b/i.test(text)) {
    return;
  }

  // Parse the command
  const { command, itemsText } = parseNaturalLanguageCommand(text);

  if (!command) {
    return; // No valid command found
  }

  // Normalize command (e.g., "create" -> "add")
  const normalizedCommand = normalizeCommand(command);

  // Skip excluded commands
  if (EXCLUDED_COMMANDS.has(normalizedCommand)) {
    console.log(`[HISTORY] Skipping excluded command: ${normalizedCommand}`);
    return;
  }

  // Extract user information
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  if (!chatId || !userId) {
    console.warn("[HISTORY] Missing chat_id or user_id, skipping history entry");
    return;
  }

  const username = ctx.from?.username ?? null;
  const firstName = ctx.from?.first_name ?? null;
  const lastName = ctx.from?.last_name ?? null;

  // Track the command
  try {
    addHistoryEntry({
      chatId,
      userId,
      username,
      firstName,
      lastName,
      command: normalizedCommand,
      items: itemsText, // Comma-separated string
    });

    console.log(`[HISTORY] Tracked: ${normalizedCommand} by user ${userId} in chat ${chatId}`);
  } catch (error) {
    console.error("[HISTORY] Failed to track command:", error);
    // Don't throw - history tracking should not break the bot
  }
}
