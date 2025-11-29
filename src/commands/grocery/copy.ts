// src/commands/grocery/copy.ts
import { BotContext, GroceryListState } from "../../lib/types";

/**
 * Handle the grocery copy command
 * Sends the grocery list in a plain text format for easy copying
 * @param ctx - The Grammy context object
 * @param state - The grocery list state
 */
export async function handleCopy(
  ctx: BotContext,
  state: GroceryListState
): Promise<void> {
  const { items } = state;

  if (items.length === 0) {
    await ctx.reply("📋 Your grocery list is empty!");
    return;
  }

  // Format as plain text list
  const lines = items.map((item) => {
    const checkMark = item.checked ? " ✓" : "";
    return `${item.name}${checkMark}`;
  });

  const listText = `Grocery List:\n\n${lines.join("\n")}`;

  // Send in a code block for easy copying
  await ctx.reply(`\`\`\`\n${listText}\n\`\`\``, {
    parse_mode: "Markdown",
  });
}
