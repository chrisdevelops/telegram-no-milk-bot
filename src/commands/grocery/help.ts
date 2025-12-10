// src/commands/grocery/help.ts
import { BotContext, GroceryListState } from "../../lib/types";

/**
 * Handle the grocery help command
 */
export async function handleHelp(
  ctx: BotContext,
  _state: GroceryListState
): Promise<void> {
  const helpText = `🛒 *Grocery List Bot Commands*

*Basic Commands:*
\`grocery list\` — Display the current grocery list
\`grocery add <items>\` — Add comma-separated items
\`grocery remove <items>\` — Remove comma-separated items
\`grocery check <items>\` — Toggle checked status (✅/◻️)
\`grocery copy\` — Get a plain text copy of the list
\`grocery clear\` — Remove all items from the list

*Sorting:*
\`grocery sort name\` — Sort alphabetically (A-Z)
\`grocery sort name reverse\` — Sort reverse alphabetically (Z-A)
\`grocery sort date\` — Sort by date added (oldest first)
\`grocery sort date reverse\` — Sort by date added (newest first)
\`grocery sort manual\` — Use manual positioning

*Shortcuts:*
\`grocery + <items>\` — Add items (alias for 'add')
\`grocery - <items>\` — Remove items (alias for 'remove')
\`grocery x <items>\` — Check items (alias for 'check')

*Special Syntax:*
\`grocery add eggs@2, milk@1\` — Add items at specific positions

*Other:*
\`grocery help\` — Show this help message
\`grocery history [page]\` — View command history (10 per page)
\`grocery debug\` — Show diagnostic information

*Examples:*
\`grocery add apples, bananas, milk\`
\`grocery check apples, milk\`
\`grocery remove bananas\`
\`grocery sort name\``;

  await ctx.reply(helpText, {
    parse_mode: "Markdown",
  });
}
