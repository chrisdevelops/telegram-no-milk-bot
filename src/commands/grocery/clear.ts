// src/commands/grocery/clear.ts
import { BotContext, GroceryListState } from "../../lib/types";
import { clearItems, getItems, setSortPreferences } from "../../db";
import { updateListMessage } from "../../lib/render";

/**
 * Handle the /grocery clear command
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 */
export async function handleClear(
  ctx: BotContext,
  state: GroceryListState
): Promise<void> {
  clearItems(state.chatId);

  // Reset to default sort mode
  setSortPreferences(state.chatId, 'date', 'asc');
  state.sortMode = 'date';
  state.sortDirection = 'asc';

  state.items = getItems(state.chatId); // Should now be empty

  await updateListMessage(ctx, state);
}
