// src/commands/grocery/index.ts
import { Bot } from "grammy";
import { getChatRecord, getItems } from "../../db";
import { BotContext, GroceryListState } from "../../lib/types";
import { handleShow } from "./show";
import { handleAdd } from "./add";
import { handleRemove } from "./remove";
import { handleCheck } from "./check";
import { handleClear } from "./clear";

/**
 * Parse comma-separated items from text input
 * @param text - The text containing comma-separated items
 * @returns Array of trimmed, non-empty item names
 */
export function parseItems(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
 * Register the /grocery command and all its subcommands
 * @param bot - The Grammy bot instance
 */
export function registerGroceryCommand(bot: Bot<BotContext>): void {
  bot.command("grocery", async (ctx) => {
    const chatId = ctx.chat?.id;
    const text = ctx.message?.text ?? "";

    if (!chatId) {
      console.error("No chat ID available in context");
      return;
    }

    const parts = text.trim().split(/\s+/);
    const restParts = parts.slice(1); // Everything after "/grocery"

    try {
      const state = makeState(chatId);

      // No subcommand - show the list
      if (restParts.length === 0) {
        await handleShow(ctx, state);
        return;
      }

      const subcommand = restParts[0].toLowerCase();
      const argsText = restParts.slice(1).join(" ").trim();
      const items = parseItems(argsText);

      console.log(`[DEBUG] Subcommand: ${subcommand}, Args: "${argsText}", Parsed items:`, items);

      switch (subcommand) {
        case "create":
        case "add":
        case "+":
          await handleAdd(ctx, state, items);
          break;
        case "remove":
        case "rm":
        case "-":
          await handleRemove(ctx, state, items);
          break;
        case "check":
        case "mark":
          await handleCheck(ctx, state, items);
          break;
        case "clear":
          await handleClear(ctx, state);
          break;
        case "help":
          await ctx.reply(
            "Usage:\n" +
            "  /grocery — show list\n" +
            "  /grocery add carrots, milk\n" +
            "  /grocery remove carrots\n" +
            "  /grocery check carrots, milk\n" +
            "  /grocery clear"
          );
          break;
        default:
          await ctx.reply("🫗 Unknown command. Use /grocery help for usage.");
          
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
