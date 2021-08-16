# Interactions Proxy

A discord application build off cloudflare workers to proxy messages to fronts. Based off the ideas from pluralkit.  
I made this because the way pluralkit sends messages, it deletes the systems message, causes a flash like effect which has caused issues for photosensitive people. The intention of this project is to bridge that gap, because ephemeral response with slash commands are not seen by anyone but the original user.  

## Disclaimer

I do not intend for this to replace plural kit or other bots, I actually think pluralkit has slash command support planned.

## Setup

Follow cloudflare workers instructions for setup with wrangler
Create secrets: `wrangler secret put {secret name}`

Secrets:

- `publicSecurityKey`
- `botToken`
- `applicationId`

Setup the kv namespace: `wrangler kv:namespace create "DATA_KV"`

Constants (`consts.ts`) need to be set to values you want

Register commands in `commands.json` to discord. See discord [docs](https://discord.dev) for this

Publish the worker.

The bot needs to be invited with both the `application.commands` scope and the `bot` scope. It must have the `MANAGE_PERMISSIONS` permission in each channel it's used in.
