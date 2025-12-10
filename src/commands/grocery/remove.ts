// src/commands/grocery/remove.ts
import { BotContext, GroceryListState } from "../../lib/types";
import { removeItems, getItems } from "../../db";
import { updateListMessage } from "../../lib/render";

/**
 * Handle the /grocery remove command
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 * @param items - Array of item names to remove
 */
export async function handleRemove(
  ctx: BotContext,
  state: GroceryListState,
  items: string[]
): Promise<void> {
  if (items.length === 0) {
    await ctx.reply(
      "❌ Please specify items to remove.\n\n" +
      "Example: grocery remove carrots, milk"
    );
    return;
  }

  removeItems(state.chatId, items);
  state.items = getItems(state.chatId);

  // Only update list message if feature flag is enabled (default: true)
  const shouldRenderAfterChanges = process.env.RENDER_LIST_AFTER_CHANGES !== 'false';
  if (shouldRenderAfterChanges) {
    await updateListMessage(ctx, state);
  }
}
