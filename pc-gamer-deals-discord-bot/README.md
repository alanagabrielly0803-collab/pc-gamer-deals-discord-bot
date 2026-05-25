# PC Gamer Deals Discord Bot

Discord bot for monitoring PC gamer deals and posting public permanent embeds to a Discord channel.

## Research report

### Recommended data sources

| Store/source | Support level | Recommended method |
|---|---:|---|
| Mercado Livre | Reliable starter source | Public Mercado Livre search endpoint |
| Amazon | Reliable only with credentials | Amazon Product Advertising API |
| Kabum | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| TerabyteShop | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| Pichau | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| Magazine Luiza | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| AliExpress | Reliable only with credentials | AliExpress affiliate/open API |
| Shopee | Reliable only with credentials | Shopee Affiliate/Open API |

### Why most scraping is experimental

Brazilian retail pages often change markup, use bot protection, or render parts of the catalog client-side. This project avoids aggressive scraping by default. `ENABLE_EXPERIMENTAL_SCRAPING=false` keeps Kabum, Terabyte, Pichau, and Magalu scraping disabled unless you intentionally enable it.

### Limitations

- Prices can change quickly.
- JSON storage can be lost if `data/deals.json` is deleted.
- Replit + UptimeRobot is suitable for hobby use, but not guaranteed production uptime.
- UptimeRobot can keep the Express endpoint warm, but it cannot guarantee Discord gateway stability.
- Amazon, AliExpress, and Shopee should be implemented with official/signed APIs before production use.
- Do not post products with unclear prices or fake/invented discounts.

## Implementation plan

The bot uses:

- Node.js
- discord.js
- Express
- Axios
- Cheerio only for optional experimental scraping
- node-cron
- JSON storage

## Search improvements

The discovery pass was expanded to search more Mercado Livre terms and to use broader hardware searches on the experimental stores. If you want even more results, enable:

```env
ENABLE_EXPERIMENTAL_SCRAPING=true
```

You can also lower `MIN_DISCOUNT_PERCENT` a bit if you want the bot to accept smaller discounts.

## Setup

### Replit Secrets

Add:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
CHANNEL_ID=
CHECK_INTERVAL_MINUTES=30
MAX_POSTS_PER_CHECK=10
MIN_DISCOUNT_PERCENT=10
MAX_PRICE=
ENABLE_EXPERIMENTAL_SCRAPING=false
PORT=3000
```

### Local development

```bash
npm install
npm run register
npm start
```

### UptimeRobot

Monitor:

```text
https://your-replit-url/health
```

Use a 5-minute interval on the free plan.

### GitHub

Do not commit `.env` or `data/deals.json`.

Commit:

- `.env.example`
- `data/.gitkeep`
- all source files

## Slash commands

- `/deals`
- `/forcecheck`
- `/status`
- `/filters`

## Testing checklist

- Bot logs into Discord.
- Slash commands register.
- `/health` returns JSON.
- `/forcecheck` runs without crashing.
- Duplicate deals are not reposted.
- Same product with lower price can post as a new deal.
- `.env` is not committed.
- Replit Secrets are set.
- UptimeRobot monitors `/health`.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Missing environment variable | Replit Secret missing | Add the missing secret |
| Invalid token | Wrong bot token | Regenerate token in Discord Developer Portal |
| Missing Access | Bot lacks channel permission | Grant Send Messages, Embed Links, Use Application Commands |
| No deals posted | Filters too strict | Lower `MIN_DISCOUNT_PERCENT` or adjust keywords |
| Scraping returns 0 | Store blocks or changed HTML | Keep scraping disabled or update selectors |
| Duplicate posts after reset | `data/deals.json` was deleted | Restore backup or accept fresh history |
