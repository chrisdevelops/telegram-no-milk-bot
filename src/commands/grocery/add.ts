// src/commands/grocery/add.ts
import { BotContext, GroceryListState, ItemWithPosition } from "../../lib/types";
import { addItemsWithPosition, getItems, setSortPreferences } from "../../db";
import { updateListMessage } from "../../lib/render";

/**
 * Handle the grocery add command with optional @position syntax
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 * @param items - Array of items with optional positions
 */
export async function handleAdd(
  ctx: BotContext,
  state: GroceryListState,
  items: ItemWithPosition[]
): Promise<void> {
  if (items.length === 0) {
    await ctx.reply(
      "❌ Please specify items to add.\n\n" +
      "Examples:\n" +
      "  grocery add carrots, milk, bread\n" +
      "  grocery add pears@3, apples@1, milk"
    );
    return;
  }

  // Check if @position syntax used
  const hasPositionSyntax = items.some(item => item.position !== null);

  // Auto-switch to manual mode if needed
  if (hasPositionSyntax && state.sortMode !== 'manual') {
    setSortPreferences(state.chatId, 'manual', 'asc');
    state.sortMode = 'manual';
    state.sortDirection = 'asc';
    console.log(`[DEBUG] Auto-switched chat ${state.chatId} to manual mode`);
  }

  addItemsWithPosition(state.chatId, items);
  state.items = getItems(state.chatId);

  await updateListMessage(ctx, state);
}
