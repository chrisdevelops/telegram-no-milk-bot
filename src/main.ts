// src/main.ts
import { Bot, GrammyError, HttpError } from "grammy";
import dotenv from "dotenv";
import { initDb, closeDb } from "./db";
import { registerGroceryCommand } from "./commands/grocery";
import { BotContext } from "./lib/types";

// Load environment variables
dotenv.config();

// Initialize database
try {
  initDb();
} catch (error) {
  console.error("Failed to initialize database. Exiting.");
  process.exit(1);
}

// Get bot token from environment
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("❌ BOT_TOKEN not set in .env file");
  console.error("Please create a .env file with your bot token:");
  console.error("BOT_TOKEN=your_telegram_bot_token_here");
  process.exit(1);
}

// Create bot instance with custom context type
const bot = new Bot<BotContext>(token);

// Register /start command
bot.command("start", async (ctx) => {
  await ctx.reply(
    "🛒 Grocery List Bot\n\n" +
    "Manage your grocery list with these commands:\n\n" +
    "  /grocery — show current list\n" +
    "  /grocery add carrots, milk\n" +
    "  /grocery remove carrots\n" +
    "  /grocery check carrots, milk\n" +
    "  /grocery clear\n\n" +
    "All list members can collaborate on the same list!"
  );
});

// Register grocery command and all subcommands
registerGroceryCommand(bot);

// Install error handler (Grammy best practice)
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const error = err.error;

  if (error instanceof GrammyError) {
    console.error("Error in request:", error.description);
  } else if (error instanceof HttpError) {
    console.error("Could not contact Telegram:", error);
  } else {
    console.error("Unknown error:", error);
  }
});

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);

  try {
    await bot.stop();
    console.log("Bot stopped");
  } catch (error) {
    console.error("Error stopping bot:", error);
  }

  closeDb();
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Start the bot
console.log("🚀 Grocery List bot is starting...");
bot.start()
  .then(() => {
    console.log("✅ Bot is running and listening for updates");
  })
  .catch((error) => {
    console.error("❌ Failed to start bot:", error);
    closeDb();
    process.exit(1);
  });
