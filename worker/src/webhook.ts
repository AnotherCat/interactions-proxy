import {
  APIEmbed,
  APIUser,
  RESTGetAPIChannelWebhooksResult,
  RESTPostAPIWebhookWithTokenWaitResult,
  RESTPostAPIChannelWebhookResult,
  RESTPostAPIWebhookWithTokenJSONBody,
  Snowflake,
} from 'discord-api-types/v9'
import {
  InternalRequestError,
  MissingPermissions,
  ReturnedError,
} from './errors'
import {
  DATA_SEPARATOR_CODE,
  logAvatarURL,
  logChannelId,
  logUsername,
  applicationId,
} from './consts'
import { createMessageInDatabase } from './pgData'
const missingPermissionsMessage =
  'The bot does not have the right permissions in this channel! Please contact your server administrator for more detail. \nNote: this message is cached for 10 minutes'

const separatorCharacter = String.fromCharCode(DATA_SEPARATOR_CODE)

export async function sendProxyMessage(
  message: string,
  avatar: string,
  name: string,
  channel: Snowflake,
  user: APIUser,
  proxyId: string,
  pronouns: string | null,
  event: FetchEvent,
  guild: Snowflake,
): Promise<void> {
  const webhookData = await getWebhook(channel)
  const data: RESTPostAPIWebhookWithTokenJSONBody = {
    content: message,
    username: name,
    avatar_url: avatar,
  }
  const messageData = await retryWebhookOnFail(data, webhookData, channel)

  event.waitUntil(
    createLogs(
      message,
      avatar,
      name,
      channel,
      user,
      messageData!,
      proxyId,
      pronouns,
      guild,
    ),
  )
}

async function createLogs(
  message: string,
  avatar: string,
  username: string,
  channel: Snowflake,
  user: APIUser,
  messageData: RESTPostAPIWebhookWithTokenWaitResult,
  proxyId: string,
  pronouns: string | null,
  guild: Snowflake,
) {
  const logMessage = await sendLogMessage(
    message,
    avatar,
    username,
    channel,
    user,
    messageData,
    proxyId,
    guild,
  )
  const a = await createMessageInDatabase(
    messageData.id,
    messageData.channel_id,
    user.id,
    guild,
    logMessage.id,
    logMessage.channel_id,
    proxyId,
    username,
    pronouns
  )
  if (!a.ok) {
    await executeWebhook(
      { content: `${a.status}\n${await a.text()}` },
      await getWebhook(channel),
    )
  }
}

async function sendLogMessage(
  message: string,
  avatar: string,
  username: string,
  channel: Snowflake,
  user: APIUser,
  messageData: RESTPostAPIWebhookWithTokenWaitResult,
  proxyId: string,
  guild: Snowflake,
): Promise<RESTPostAPIWebhookWithTokenWaitResult> {
  const embed: APIEmbed = {
    title: 'Jump to message',
    url: `https://discord.com/channels/${guild}/${messageData.channel_id}/${messageData.id}`,
    author: {
      icon_url: avatar,
      name: `Front: ${username} (${proxyId})`,
    },
    description:
      `Message ${messageData.id} proxied to <#${channel}>` +
      `\n**Content:** ${message}` +
      `\n**Click to open profile:** <discord://-/users/${user.id}>`,
    footer: {
      text: `${user.username}#${user.discriminator} (${user.id})`,
      icon_url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`,
    },
    color: 3066993,
    timestamp: messageData.timestamp,
  }
  return await retryWebhookOnFail(
    {
      embeds: [embed],
      username: logUsername,
      avatar_url: logAvatarURL,
    },
    await getWebhook(logChannelId),
    logChannelId,
  )
}

async function retryWebhookOnFail(
  data: RESTPostAPIWebhookWithTokenJSONBody,
  webhook: WebhookWithToken,
  channel: Snowflake,
): Promise<RESTPostAPIWebhookWithTokenWaitResult> {
  const messageData = await executeWebhook(data, webhook).catch(async function (
    error,
  ) {
    if (error instanceof InternalRequestError) {
      if (error.response.status === 404) {
        webhook = await handleWebhookNotFound(channel)
        await executeWebhook(data, webhook)
      } else {
        const textBody = await error.response.text()
        let jsonBody = null
        try {
          jsonBody = JSON.parse(textBody)
        } catch (error) {
          
        }
        if (
          error.response.status === 400 &&
          jsonBody !== null &&
          'username' in jsonBody
        ) {
          throw new ReturnedError(
            'The username was rejected by discord, please update the username for this front.' +
              `\nError: ${jsonBody.username}`,
          )
        } else {
          throw new ReturnedError(
            `Proxying failed with the status \`${error.response.status}\` and the error\`${textBody}\`` +
              '\nPlease copy this error and contact the developer with the error.',
          )
        }
      }
    }
  })
  return messageData!
}

async function executeWebhook(
  data: RESTPostAPIWebhookWithTokenJSONBody,
  webhook: WebhookWithToken,
): Promise<RESTPostAPIWebhookWithTokenWaitResult> {
  const webhookURL = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}?wait=true`
  const resp = await fetch(webhookURL, {
    body: JSON.stringify(data),
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  })
  if (!resp.ok) {
    throw new InternalRequestError(
      `Proxying your message failed with the status code ${resp.status}`,
      resp,
    )
  }
  return resp.json()
}

// webhook stored in the format. Key: "webhook${separatorCharacter}channelid" Data: "webhookid${separatorCharacter}webhooktoken"
// missing permissions stored in the format. Key: "invalid${separatorCharacter}webhook${separatorCharacter}channelid" Data: "null", expires in 10mins

interface WebhookWithToken {
  token: string
  id: string
}

async function handleWebhookNotFound(
  channel: Snowflake,
): Promise<WebhookWithToken> {
  await DATA_KV.delete(`webhook${separatorCharacter}${channel}`)
  return await getWebhook(channel)
}

async function checkCachedMissingPermissions(
  channel: Snowflake,
): Promise<boolean> {
  const resp = await DATA_KV.get(
    `invalid${separatorCharacter}webhook${separatorCharacter}${channel}`,
  )
  if (resp === null) {
    return false
  } else {
    return true
  }
}

async function getWebhook(channel: Snowflake): Promise<WebhookWithToken> {
  if (await checkCachedMissingPermissions(channel)) {
    throw new MissingPermissions(missingPermissionsMessage)
  }
  const data = await DATA_KV.get(`webhook:${channel}`)
  if (data === null) {
    let getWebhook = await getChannelWebhooks(channel)
    if (getWebhook === null) {
      getWebhook = await createChannelWebhook(channel)
    }
    await DATA_KV.put(
      `webhook${separatorCharacter}${channel}`,
      `${getWebhook.id}${separatorCharacter}${getWebhook.token}`,
    )
    return getWebhook
  } else {
    const splitValues = data.split(separatorCharacter)
    return {
      id: splitValues[0],
      token: splitValues[1],
    }
  }
}

async function getChannelWebhooks(
  channel: Snowflake,
): Promise<WebhookWithToken | null> {
  const getWebhookResponse = await fetch(
    `https://discord.com/api/v9/channels/${channel}/webhooks`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  )
  if (
    (getWebhookResponse.headers.get('Content-Type') || '') !==
      'application/json' ||
    getWebhookResponse.status !== 200
  ) {
    await DATA_KV.put(`invalid:webhook:${channel}`, 'null', {
      expirationTtl: 600,
    })
    throw new MissingPermissions(missingPermissionsMessage)
  }
  const createWebhookJSONResponse: RESTGetAPIChannelWebhooksResult =
    await getWebhookResponse.json()
  for (let index = 0; index < createWebhookJSONResponse.length; index++) {
    const webhook = createWebhookJSONResponse[index]
    if (
      webhook.user == undefined ||
      webhook.user.id !== applicationId ||
      webhook.token === undefined
    ) {
      continue
    } else {
      return {
        token: webhook.token,
        id: webhook.id,
      }
    }
  }
  return null
}

async function createChannelWebhook(
  channel: Snowflake,
): Promise<WebhookWithToken> {
  const createWebhookResponse = await fetch(
    `https://discord.com/api/v9/channels/${channel}/webhooks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Proxy Webhook',
      }),
    },
  )
  const responseBody: RESTPostAPIChannelWebhookResult =
    await createWebhookResponse.json()
  if (
    (createWebhookResponse.headers.get('Content-Type') || '') !==
      'application/json' ||
    createWebhookResponse.status !== 200 ||
    responseBody.token == undefined
  ) {
    await DATA_KV.put(
      `invalid${separatorCharacter}webhook${separatorCharacter}${channel}`,
      'null',
      { expirationTtl: 600 },
    )
    throw new MissingPermissions(missingPermissionsMessage)
  }
  return { token: responseBody.token, id: responseBody.id }
}
