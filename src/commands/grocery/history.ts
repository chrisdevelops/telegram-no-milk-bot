// src/commands/grocery/history.ts
import { BotContext } from "../../lib/types";
import { getHistoryPage, HistoryEntry } from "../../db";
import { getHistoryConfig } from "../../lib/config";

/**
 * Handles the `grocery history [page]` command
 */
export async function handleHistory(
  ctx: BotContext,
  itemsText: string
): Promise<void> {
  const config = getHistoryConfig();

  // Check if history is enabled
  if (!config.enabled) {
    await ctx.reply(
      "History tracking is currently disabled.\n\n" +
      "Set HISTORY_ENABLED=true in your environment to enable it."
    );
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply("Error: Unable to determine chat ID.");
    return;
  }

  // Parse page number from itemsText (default to 1)
  const pageNum = (() => {
    const trimmed = itemsText.trim();
    if (!trimmed) return 1;
    const parsed = parseInt(trimmed, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  })();

  // Fetch paginated history
  const { entries, totalEntries, totalPages, currentPage } = getHistoryPage(
    chatId,
    pageNum
  );

  // Handle empty history
  if (totalEntries === 0) {
    await ctx.reply("No command history found for this chat.");
    return;
  }

  // Handle invalid page number
  if (currentPage > totalPages) {
    await ctx.reply(
      `Invalid page number. There are only ${totalPages} page(s) available.\n\n` +
      `Use: \`grocery history [page]\` (1-${totalPages})`
    );
    return;
  }

  // Format and display the history table
  const table = formatHistoryTable(entries, config.userFormat);
  const footer = `\nPage ${currentPage}/${totalPages} • ${totalEntries} total entries`;

  await ctx.reply(
    `\`\`\`\n${table}${footer}\n\`\`\``,
    { parse_mode: "Markdown" }
  );
}

/**
 * Format user display based on configured format
 */
function formatUser(
  userId: number,
  username: string | null,
  firstName: string | null,
  lastName: string | null,
  format: "username" | "userid" | "both"
): string {
  switch (format) {
    case "username":
      if (username) return `@${username}`;
      if (firstName) {
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;
        return fullName;
      }
      return `User ${userId}`;

    case "userid":
      return userId.toString();

    case "both":
      if (username) {
        const name = firstName || "User";
        return `${name} (@${username})`;
      }
      if (firstName) {
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;
        return `${fullName} (${userId})`;
      }
      return userId.toString();
  }
}

/**
 * Format Unix timestamp as relative time or absolute timestamp
 */
function formatTimestamp(unixSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;

  // If less than 24 hours, show relative time
  if (diff < 86400) {
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  // Otherwise show absolute timestamp
  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format history entries as an ASCII table
 */
function formatHistoryTable(
  entries: HistoryEntry[],
  userFormat: "username" | "userid" | "both"
): string {
  if (entries.length === 0) {
    return "(no history)";
  }

  // Calculate column widths
  const userWidth = Math.max(
    20,
    ...entries.map((e) =>
      formatUser(e.userId, e.username, e.firstName, e.lastName, userFormat).length
    )
  );
  const commandWidth = Math.max(
    8,
    ...entries.map((e) => e.command.length)
  );
  const itemsWidth = Math.max(
    30,
    ...entries.map((e) => (e.items || "(none)").length)
  );
  const whenWidth = 16;

  // Build header
  const header = [
    pad("User", userWidth, "left"),
    pad("Command", commandWidth, "left"),
    pad("Items", itemsWidth, "left"),
    pad("When", whenWidth, "left"),
  ].join(" | ");

  const separator = "-".repeat(header.length);

  // Build rows
  const rows = entries.map((entry) => {
    const user = formatUser(
      entry.userId,
      entry.username,
      entry.firstName,
      entry.lastName,
      userFormat
    );
    const command = entry.command;
    const items = entry.items || "(none)";
    const when = formatTimestamp(entry.timestamp ?? 0);

    return [
      pad(user, userWidth, "left"),
      pad(command, commandWidth, "left"),
      pad(items, itemsWidth, "left"),
      pad(when, whenWidth, "left"),
    ].join(" | ");
  });

  return [header, separator, ...rows].join("\n");
}

/**
 * Pad a string to a specific width with alignment
 */
function pad(str: string, width: number, align: "left" | "right"): string {
  if (str.length >= width) {
    return str.substring(0, width);
  }

  const padding = " ".repeat(width - str.length);
  return align === "left" ? str + padding : padding + str;
}
