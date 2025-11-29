// src/commands/grocery/add.ts
import { BotContext, GroceryListState } from "../../lib/types";
import { addItems, getItems } from "../../db";
import { updateListMessage } from "../../lib/render";

/**
 * Handle the /grocery add command
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 * @param items - Array of item names to add
 */
export async function handleAdd(
  ctx: BotContext,
  state: GroceryListState,
  items: string[]
): Promise<void> {
  if (items.length === 0) {
    await ctx.reply(
      "❌ Please specify items to add.\n\n" +
      "Example: grocery add carrots, milk, bread"
    );
    return;
  }

  addItems(state.chatId, items);
  state.items = getItems(state.chatId);

  await updateListMessage(ctx, state);
}
