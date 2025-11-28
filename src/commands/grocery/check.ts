// src/commands/grocery/check.ts
import { BotContext, GroceryListState } from "../../lib/types";
import { checkItems, getItems } from "../../db";
import { updateListMessage } from "../../lib/render";

/**
 * Handle the /grocery check command
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 * @param items - Array of item names to mark as checked
 */
export async function handleCheck(
  ctx: BotContext,
  state: GroceryListState,
  items: string[]
): Promise<void> {
  if (items.length === 0) {
    await ctx.reply(
      "❌ Please specify items to check off.\n\n" +
      "Example: /grocery check carrots, milk"
    );
    return;
  }

  checkItems(state.chatId, items);
  state.items = getItems(state.chatId);

  await updateListMessage(ctx, state);
}
