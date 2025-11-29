# Docker Deployment Guide

This guide explains how to run the Telegram Grocery Bot using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, but recommended)
- Telegram Bot Token (get one from [@BotFather](https://t.me/botfather))

## Quick Start with Docker Compose

1. **Clone the repository** (if you haven't already)

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file** and add your bot token:
   ```
   BOT_TOKEN=your_telegram_bot_token_here
   ```

4. **Start the bot**
   ```bash
   docker-compose up -d
   ```

5. **View logs**
   ```bash
   docker-compose logs -f
   ```

6. **Stop the bot**
   ```bash
   docker-compose down
   ```

## Using Docker (without Compose)

1. **Build the image**
   ```bash
   docker build -t telegram-grocery-bot .
   ```

2. **Create data directory**
   ```bash
   mkdir -p ./data
   ```

3. **Run the container**
   ```bash
   docker run -d \
     --name grocery-bot \
     --restart unless-stopped \
     -e BOT_TOKEN=your_telegram_bot_token_here \
     -v $(pwd)/data:/app/data \
     telegram-grocery-bot
   ```

4. **View logs**
   ```bash
   docker logs -f grocery-bot
   ```

5. **Stop the container**
   ```bash
   docker stop grocery-bot
   docker rm grocery-bot
   ```

## Data Persistence

The database is stored in a Docker volume mounted at `/app/data` inside the container, which maps to `./data` on your host machine. This ensures your grocery lists persist even when the container is restarted or recreated.

## Updating the Bot

1. **Pull latest changes** (if using git)
   ```bash
   git pull
   ```

2. **Rebuild and restart**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## Environment Variables

- `BOT_TOKEN` (required): Your Telegram bot token
- `DB_PATH` (optional): Database file path (default: `/app/data/grocery.db`)
- `DELETE_COMMAND_MESSAGES` (optional): Set to `true` to delete command messages
- `NODE_ENV` (optional): Set to `production` for production deployment

## Resource Limits

The `docker-compose.yml` file includes default resource limits:
- CPU: 0.5 cores max, 0.25 cores reserved
- Memory: 256MB max, 128MB reserved

Adjust these in `docker-compose.yml` if needed.

## Troubleshooting

### Bot not starting
Check logs for errors:
```bash
docker-compose logs grocery-bot
```

### Permission issues
Ensure the data directory is writable:
```bash
chmod 755 ./data
```

### Database locked
Stop all containers accessing the database:
```bash
docker-compose down
docker-compose up -d
```

## Multi-Platform Builds

To build for different architectures (e.g., ARM for Raspberry Pi):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t telegram-grocery-bot .
```

## Security Notes

- The container runs as a non-root user (nodejs:1001)
- No ports are exposed by default (bot uses Telegram's long polling)
- Environment variables should never be committed to version control
- Use `.env` file for local secrets (it's in `.gitignore`)
