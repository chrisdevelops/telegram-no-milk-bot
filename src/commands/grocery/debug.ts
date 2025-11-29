// src/commands/grocery/debug.ts
import { BotContext, GroceryListState } from "../../lib/types";
import { getItemsWithDebugInfo, getDatabaseSize } from "../../db";
import { getBotUptime } from "../../main";

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format milliseconds to human-readable uptime
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format Unix timestamp to human-readable date
 */
function formatTimestamp(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

/**
 * Pad string to fixed width for table alignment
 */
function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  const strLen = str.length;
  if (strLen >= width) return str.substring(0, width);
  const padding = ' '.repeat(width - strLen);
  return align === 'left' ? str + padding : padding + str;
}

/**
 * Handle the grocery debug command
 */
export async function handleDebug(
  ctx: BotContext,
  state: GroceryListState
): Promise<void> {
  const { chatId, lastMessageId, sortMode, sortDirection } = state;

  // Get extended item data
  const debugItems = getItemsWithDebugInfo(chatId);
  const dbSize = getDatabaseSize();
  const uptime = getBotUptime();

  // Build state information section
  const stateLines = [
    `Chat ID:         ${chatId}`,
    `Sort Mode:       ${sortMode}`,
    `Sort Direction:  ${sortDirection}`,
    `Last Message ID: ${lastMessageId ?? 'null'}`,
    `Total Items:     ${debugItems.length}`,
    `Database Path:   ${process.env.DB_PATH ?? './grocery.db'}`,
    `Database Size:   ${dbSize ? formatBytes(dbSize) : 'unknown'}`,
    `Bot Uptime:      ${formatUptime(uptime)}`,
    `Node Version:    ${process.version}`,
  ];

  // Build items table
  let itemsTable = '';
  if (debugItems.length === 0) {
    itemsTable = '(no items)';
  } else {
    // Calculate current display positions based on state.items order
    const positionMap = new Map<number, number>();
    state.items.forEach((item, index) => {
      positionMap.set(item.id, index + 1);
    });

    // Table header
    const header = `${pad('Pos', 4, 'right')} | ${pad('ID', 4, 'right')} | ${pad('Name', 25)} | ${pad('✓', 3)} | ${pad('Sort', 5, 'right')} | ${pad('Created', 20)}`;
    const separator = '-'.repeat(header.length);

    // Table rows
    const rows = debugItems.map((item) => {
      const pos = positionMap.get(item.id) ?? '?';
      const checked = item.checked ? '✓' : '✗';
      const created = formatTimestamp(item.createdAt);

      return `${pad(String(pos), 4, 'right')} | ${pad(String(item.id), 4, 'right')} | ${pad(item.name, 25)} | ${pad(checked, 3)} | ${pad(String(item.sortOrder), 5, 'right')} | ${pad(created, 20)}`;
    });

    itemsTable = [header, separator, ...rows].join('\n');
  }

  // Combine everything
  const debugOutput = [
    '🐛 DEBUG INFO',
    '',
    '=== STATE ===',
    ...stateLines,
    '',
    '=== ITEMS ===',
    itemsTable,
  ].join('\n');

  // Send as code block for monospace formatting
  await ctx.reply(`\`\`\`\n${debugOutput}\n\`\`\``, {
    parse_mode: "Markdown",
  });
}
