# Gamer Accessory Deals Discord Bot

Discord bot for monitoring gamer accessory deals and posting public permanent embeds to a Discord channel.

## Research report

### Recommended data sources

| Store/source | Support level | Recommended method |
|---|---:|---|
| Mercado Livre | Reliable starter source | Public Mercado Livre search endpoint |
| Kalunga | Reliable starter source | Public Kalunga search pages |
| Amazon | Reliable only with credentials | Amazon Product Advertising API |
| Kabum | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| TerabyteShop | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| Pichau | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| Magazine Luiza | Experimental | Avoid by default; optional low-rate JSON-LD scraping |
| AliExpress | Reliable only with credentials | AliExpress affiliate/open API |
| Shopee | Reliable only with credentials | Shopee Affiliate/Open API |

### Why most scraping is experimental

Brazilian retail pages often change markup, use bot protection, or render parts of the catalog client-side. This project now enables experimental scraping by default, so Kabum, Terabyte, Pichau, and Magalu can be searched too. If you want to turn them off, set `ENABLE_EXPERIMENTAL_SCRAPING=false`.

For marketplaces and official affiliate APIs, the bot is designed around these sources:

- Mercado Livre public search API for broad marketplace coverage.
- Kalunga public catalog pages for a reliable retail catalog.
- Shopee Open Platform or affiliate API when credentials are configured.
- AliExpress affiliate API when credentials are configured.
- Amazon Creators API, not the deprecated PA-API, when credentials are configured.

### Limitations

- Prices can change quickly.
- JSON storage can be lost if `data/deals.json` is deleted.
- Render Web Service + UptimeRobot is suitable for hobby use, but not guaranteed production uptime.
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

The discovery pass is focused on gamer accessories and practical upgrades: keyboards, mice, headsets, mousepads, microphones, webcams, controllers, USB hubs, capture cards, chairs, monitors, RAM, water coolers and similar items.
Kalunga is now included as an always-on source, so the bot has one more large retail catalog to search without needing experimental scraping.
The product taxonomy is centralized in `utils/dealTaxonomy.js`, which keeps keywords, categories and store lists grouped instead of scattered through the codebase.

If you want to force-enable experimental sources locally or on Render, set:

```env
ENABLE_EXPERIMENTAL_SCRAPING=true
```

The bot now posts products with an explicit percentage discount and can also surface the lowest price found among similar offers for comparison.
If you want more results, lower `MIN_DISCOUNT_PERCENT`.

## Setup

### Render environment variables

Add:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
CHANNEL_ID=
CHECK_INTERVAL_MINUTES=30
MAX_POSTS_PER_CHECK=10
MIN_DISCOUNT_PERCENT=1
MAX_PRICE=
ENABLE_EXPERIMENTAL_SCRAPING=true
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
https://your-render-url.onrender.com/health
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
- Render environment variables are set.
- UptimeRobot monitors `/health`.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Missing environment variable | Render variable missing | Add the missing environment variable |
| Invalid token | Wrong bot token | Regenerate token in Discord Developer Portal |
| Missing Access | Bot lacks channel permission | Grant Send Messages, Embed Links, Use Application Commands |
| No deals posted | Filters too strict | Lower `MIN_DISCOUNT_PERCENT` or adjust keywords |
| Scraping returns 0 | Store blocks or changed HTML | Keep scraping disabled or update selectors |
| Duplicate posts after reset | `data/deals.json` was deleted | Restore backup or accept fresh history |
