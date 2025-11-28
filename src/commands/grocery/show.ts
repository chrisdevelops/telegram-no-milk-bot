// src/commands/grocery/show.ts
import { BotContext, GroceryListState } from "../../lib/types";
import { updateListMessage } from "../../lib/render";

/**
 * Handle the /grocery command (show the current list)
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 */
export async function handleShow(
  ctx: BotContext,
  state: GroceryListState
): Promise<void> {
  await updateListMessage(ctx, state);
}
