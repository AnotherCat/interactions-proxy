import {
  APIEmbed,
  APIMessage,
  APIUser,
  Snowflake,
  RESTPostAPICurrentUserCreateDMChannelResult,
  APIChannel,
} from 'discord-api-types'
import { InternalRequestError } from './errors'
import { version } from './version'

const BASE_URL = 'https://discord.com/api/v9'
const REPO_URL = 'https://github.com/AnotherCat/interactions-proxy'

async function makeAPIRequest(
  url: string,
  { data, method }: { data?: Record<string, any>; method?: string } = {},
): Promise<Response> {
  if (!method) method = 'GET'
  const headers = {
    Authorization: `Bot ${botToken}`,
    'User-Agent': `DiscordBot (${REPO_URL}, ${version})`,
  }
  if (data) {
    return fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': `application/json`,
        ...headers,
      },
      body: JSON.stringify(data),
      method,
    })
  } else {
    return fetch(`${BASE_URL}${url}`, {
      headers: headers,
      method,
    })
  }
}


async function getUser(accountId: Snowflake): Promise<APIUser | null> {
  if (await DATA_KV.get(`notfound:user:${accountId}`)) {
    return null
  }
  const data = await makeAPIRequest(`/users/${accountId}`)
  if (data.ok) {
    let user
    try {
      user = (await data.json()) as APIUser
    } catch (error) {
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
  const data = await makeAPIRequest(`/users/@me/channels`, {
    method: 'POST',
    data: {
      recipient_id: accountId,
    },
  })
  if (!data.ok) {
    throw new InternalRequestError(await data.text(), data)
  }
  const channel: RESTPostAPICurrentUserCreateDMChannelResult = await data.json()
  const messageData = await makeAPIRequest(`/channels/${channel.id}/messages`, {
    method: 'POST',
    data: {
      content: content,
      embed: embed,
    },
  })
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
  const url = `/channels/${channelId}/messages/${messageId}`
  const resp = await makeAPIRequest(url, {
    method: 'GET',
  })
  if (!resp.ok) {
    throw new InternalRequestError(await resp.text(), resp)
  }
  return (await resp.json()) as APIMessage
}

async function getChannel(channelId: Snowflake): Promise<APIChannel> {
  const url = `/channels/${channelId}`
  const resp = await makeAPIRequest(url, {
    method: 'GET',
  })
  if (!resp.ok) {
    throw new InternalRequestError(await resp.text(), resp)
  }
  return (await resp.json()) as APIChannel
}
export { getUser, sendDMMessage, getMessage, getChannel, makeAPIRequest }
