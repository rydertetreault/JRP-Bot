# Jeff Ray Discord Bot

Jeff Ray is the official bot of the **Jeff Ray P** server. He answers questions as an oracle,
roasts and compliments members, and administers the full justice system of the
**JRP Bill of Rights** — sentencing, trials, records, and court transcripts.

> "For the JRP, by the JRP."

## Commands

### Fun
| Command | Description |
|---|---|
| `/askjrp [question]` | Ask the oracle a yes/no question. |
| `/roast [user]` | Jeff Ray roasts someone. |
| `/compliment [user]` | Jeff Ray compliments someone. |

### Justice System
| Command | Description | Access |
|---|---|---|
| `/sentence` | Issue a sentence under Article IV. Tier is **derived automatically** from category, pejorative use, and count — per the Bill of Rights. B Tier 3 (>5 uses) applies 25 years per use (Art. IV §3). | Judicial Party (𝙅𝙍𝙋𝙨) |
| `/penalty` | Issue an Article V penalty (Contempt, Gaslighting, Baiting, Fraud, Begging for sentencing). | Judicial Party |
| `/trial start` | Enact a trial under Article III. Verifies live: judge in VC (§1.A), ≥3 JRPs present outside the judicial party (§1.B). Runs the coin flip, two-minute opening statement timers (§2), jury voting via buttons, and verdicts. The judge may veto and go straight to sentencing (Art. V §1). | Judicial Party |
| `/trial status` / `/trial cancel` | Inspect or adjourn the active trial. | cancel: Judicial Party |
| `/record [user]` | View total jail time and case count. | Everyone |
| `/casefile <user>` | Paginated case history with prev/next buttons. | Everyone |
| `/topcriminals [limit]` | Most-wanted leaderboard. | Everyone |
| `/reduce <user> <years>` | Reduce a record. | Judicial Party |
| `/overturn <user>` | Vacate the most recent sentence. | Judicial Party |
| `/expunge <user>` | Wipe a record entirely (with confirmation button). | Judicial Party |
| `/lawbook [section]` | Read the Bill of Rights, with autocomplete section search. | Everyone |

All judicial actions are logged as embeds to the court-transcripts channel.

## Project Structure

```
src/
  index.js            client bootstrap + command/event loaders
  deploy-commands.js  slash command registration (run via npm run deploy)
  config.js           env + role/channel IDs + colors
  commands/           one file per slash command
  events/             ready, guildMemberAdd, interactionCreate
  lib/
    sentencing.js     Article IV/V sentencing engine (pure logic, tested)
    lawbook.js        Bill of Rights full text, structured
    trials.js         Article III trial state machine
    registry.js       jail-time records (atomic JSON persistence)
    util.js           embeds, permissions, transcripts
    flavor.js         oracle/roast/compliment lines
test/
  sentencing.test.js  node:test suite for the sentencing engine
```

## Environment Variables (.env)

```
TOKEN=your_bot_token
CLIENT_ID=your_bot_client_id
GUILD_ID=your_discord_guild_id
COURT_CHANNEL_ID=court_transcripts_channel_id      # optional
SENTENCING_CHANNEL_ID=sentencing_channel_id        # optional (has server default)
BILL_OF_RIGHTS_CHANNEL_ID=bill_of_rights_channel   # optional (has server default)
JUDICIAL_ROLE_IDS=comma,separated,role_ids         # optional (defaults to 𝙅𝙍𝙋𝙨)
JRP_ROLE_ID=role_counted_for_trial_quorum          # optional (defaults to 𝙅𝙍𝙋𝙨)
```

## Setup

```bash
npm install
npm run deploy   # register slash commands (run once, or after command changes)
npm start        # run the bot
npm run dev      # run with auto-restart on file changes
npm test         # run the sentencing engine test suite
```
