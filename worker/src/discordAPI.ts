import {
  APIEmbed,
  APIMessage,
  APIUser,
  Snowflake,
  RESTPostAPICurrentUserCreateDMChannelResult,
} from 'discord-api-types'
import { InternalRequestError } from './errors'

async function getUser(accountId: Snowflake): Promise<APIUser | null> {
  if (await DATA_KV.get(`notfound:user:${accountId}`)) {
    return null
  }
  const data = await fetch(`https://discord.com/api/v9/users/${accountId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  })
  if (data.ok) {
    let user
    try {
      user = (await data.json()) as APIUser
    } catch (error) {
      console.error(error.message)
      console.error(typeof error)
      return null
    }
    return user
  } else if (data.status === 404) {
    await DATA_KV.put(`notfound:user:${accountId}`, 'null', {
      expirationTtl: 86400,
    })
    return null
  } else {
    throw new InternalRequestError(await data.text(), data)
  }
}

async function sendDMMessage(
  accountId: Snowflake,
  content: string | null,
  embed: APIEmbed | null,
): Promise<APIMessage | null> {
  const data = await fetch(`https://discord.com/api/v9/users/@me/channels`, {
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': `application/json`,
    },
    method: 'POST',
    body: JSON.stringify({
      recipient_id: accountId,
    }),
  })
  if (!data.ok) {
    throw new InternalRequestError(await data.text(), data)
  }
  const channel: RESTPostAPICurrentUserCreateDMChannelResult = await data.json()
  const messageData = await fetch(
    `https://discord.com/api/v9/channels/${channel.id}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': `application/json`,
      },
      body: JSON.stringify({
        content: content,
        embed: embed,
      }),
    },
  )
  if (!messageData.ok) {
    if (messageData.status === 403) {
      return null
    } else {
      throw new InternalRequestError(await messageData.text(), data)
    }
  }

  return (await messageData.json()) as APIMessage
}

async function getMessage(
  channelId: Snowflake,
  messageId: Snowflake,
): Promise<APIMessage> {
  const url = `https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  })
  if (!resp.ok) {
    throw new InternalRequestError(await resp.text(), resp)
  }
  return (await resp.json()) as APIMessage
}

export { getUser, sendDMMessage, getMessage }
