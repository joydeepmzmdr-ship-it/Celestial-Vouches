# Celestial Vouches

A simple Discord vouch bot for Celestial Dynasty.

## Commands

- `/vouch user reason` — gives a member a vouch
- `/vouches user` — shows total and recent vouches
- `/leaderboard` — shows the top 10 members by vouches
- `/removevouch id` — removes a vouch; only the Discord server owner can use it

## Vouch embed

Each vouch message includes:
- A mention of the recipient
- Recipient's Discord avatar as the thumbnail
- Vouch reason
- Total vouches
- Mention of the person who gave the vouch
- Timestamp

No star rating is used.

## Setup

1. Install Node.js 22.12.0 or newer.
2. Put `index.js`, `package.json`, and `.env` in the same folder.
3. In `.env`, replace the placeholder with your bot token:
   `DISCORD_TOKEN=YOUR_TOKEN`
4. Run:
   `npm install`
5. Start:
   `npm start`

The bot registers the slash commands to every server it is currently in. Guild commands are used so the commands appear immediately while testing.

IMPORTANT: Never upload `.env` or share your bot token. If the token is exposed, reset it in the Discord Developer Portal.
