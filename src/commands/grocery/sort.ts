// src/commands/grocery/sort.ts
import { BotContext, GroceryListState, SortMode, SortDirection } from "../../lib/types";
import { setSortPreferences, getItems } from "../../db";
import { updateListMessage } from "../../lib/render";

/**
 * Parse sort command arguments
 * @param args - The argument string (e.g., "name", "date reverse")
 * @returns Object with sortType and direction, or null if invalid
 */
function parseSortArgs(args: string): {
  sortType: SortMode;
  direction: SortDirection
} | null {
  const normalized = args.trim().toLowerCase();
  const parts = normalized.split(/\s+/);

  // Extract sort type
  const sortTypeArg = parts[0];
  let sortType: SortMode;

  if (sortTypeArg === 'name' || sortTypeArg === 'alphabetical' || sortTypeArg === 'alpha') {
    sortType = 'name';
  } else if (sortTypeArg === 'date' || sortTypeArg === 'time' || sortTypeArg === 'chronological') {
    sortType = 'date';
  } else if (sortTypeArg === 'manual' || sortTypeArg === 'position') {
    sortType = 'manual';
  } else {
    return null;
  }

  // Extract direction (ignored for manual mode)
  let direction: SortDirection = 'asc';

  if (sortType !== 'manual' && parts.length > 1) {
    const directionArg = parts[1];
    if (directionArg === 'reverse' || directionArg === 'desc' || directionArg === 'descending') {
      direction = 'desc';
    }
  }

  return { sortType, direction };
}

/**
 * Handle the grocery sort command
 */
export async function handleSort(
  ctx: BotContext,
  state: GroceryListState,
  args: string
): Promise<void> {
  // Show current sort mode if no arguments
  if (!args || args.trim().length === 0) {
    const modeEmoji = state.sortMode === 'manual' ? '🔢' :
                      state.sortMode === 'name' ? '🔤' : '📅';
    const directionText = state.sortMode === 'manual' ? '' :
                          ` (${state.sortDirection === 'asc' ? 'ascending' : 'descending'})`;

    await ctx.reply(
      `${modeEmoji} Current sort: ${state.sortMode}${directionText}\n\n` +
      "Change sort order:\n" +
      "  grocery sort name — alphabetical (A-Z)\n" +
      "  grocery sort name reverse — reverse (Z-A)\n" +
      "  grocery sort date — chronological (oldest first)\n" +
      "  grocery sort date reverse — newest first\n" +
      "  grocery sort manual — manual positioning\n\n" +
      "Tip: Using @position (e.g., 'eggs@2') auto-switches to manual mode"
    );
    return;
  }

  const parsed = parseSortArgs(args);

  if (!parsed) {
    await ctx.reply(
      "❌ Invalid sort type.\n\n" +
      "Valid options:\n" +
      "  grocery sort name [reverse]\n" +
      "  grocery sort date [reverse]\n" +
      "  grocery sort manual"
    );
    return;
  }

  const { sortType, direction } = parsed;

  // Update database
  setSortPreferences(state.chatId, sortType, direction);

  // Update state
  state.sortMode = sortType;
  state.sortDirection = direction;
  state.items = getItems(state.chatId);

  // Update the message with re-sorted list
  await updateListMessage(ctx, state);
}
