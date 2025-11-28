// src/lib/render.ts
import { GrammyError } from "grammy";
import { BotContext, GroceryListState } from "./types";
import { setLastMessageId } from "../db";

/**
 * Render the grocery list as a formatted text string
 * @param state - The grocery list state
 * @returns Formatted text representation of the list
 */
export function renderList(state: GroceryListState): string {
  const { items } = state;

  if (items.length === 0) {
    return "🛒 Grocery List\n\n(empty)";
  }

  const lines = items.map((item) => {
    const checkMark = item.checked ? "✅" : "◻️";
    return `${checkMark} ${item.name}`;
  });

  return `🛒 Grocery List\n\n${lines.join("\n")}`;
}

/**
 * Update the grocery list message by deleting the old message and sending a new one
 * This ensures the message always appears at the bottom of the chat
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 * @throws Error if message operations fail
 */
export async function updateListMessage(
  ctx: BotContext,
  state: GroceryListState
): Promise<void> {
  const chatId = state.chatId;
  const text = renderList(state);

  // Delete the old message if it exists
  if (state.lastMessageId) {
    try {
      await ctx.api.deleteMessage(chatId, state.lastMessageId);
    } catch (error) {
      // Ignore errors when deleting old messages (message might already be deleted)
      if (error instanceof GrammyError) {
        console.warn(`Could not delete message ${state.lastMessageId}:`, error.description);
      } else {
        console.warn(`Could not delete message ${state.lastMessageId}:`, error);
      }
    }
  }

  // Send a new message with the updated list
  try {
    const newMessage = await ctx.api.sendMessage(chatId, text);
    setLastMessageId(chatId, newMessage.message_id);
    state.lastMessageId = newMessage.message_id;
  } catch (error) {
    if (error instanceof GrammyError) {
      console.error(`Failed to send grocery list message:`, error.description);
      throw new Error(`Could not send message: ${error.description}`);
    }
    throw error;
  }
}
