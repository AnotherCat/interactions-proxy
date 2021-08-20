# Worker section

This is the proxy service, the service that handles proxying the messages.  
This can run independent of the backend service, and does not rely on the backend to proxy messages,
it does however require the backend for lookup commands to work.

## Setup

Follow cloudflare workers instructions for setup with wrangler
Create secrets: `wrangler secret put {secret name}`

Secrets:

- `publicSecurityKey` - Discord interactions public key
- `botToken` - Discord bot token
- `databaseURL` - The url of the tunnel that the postgrest docker instance is connected to
- `databaseAuthToken` - The JWT token with `{"role": "readwrite"}` claims signed with the jwt secret setup in the docker setup.

Setup the kv namespace: `wrangler kv:namespace create "DATA_KV"`

Constants (`consts.ts`) need to be set to values you want

Register commands in `commands.json` to discord. See discord [docs](https://discord.dev) for this

Publish the worker.

The bot needs to be invited with both the `application.commands` scope and the `bot` scope. It must have the `MANAGE_PERMISSIONS` permission in each channel it's used in.
