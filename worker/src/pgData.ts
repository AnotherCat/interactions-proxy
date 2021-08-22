import { Snowflake } from 'discord-api-types/v9'
import { InternalRequestError, ReturnedError } from './errors'
interface storedMessageData {
  message_id: Snowflake
  channel_id: Snowflake
  account_id: Snowflake
  guild_id: Snowflake
  log_message_id: Snowflake
  log_channel_id: Snowflake
  proxy_id: string
  proxy_name: string
}

async function createMessageInDatabase(
  messageId: Snowflake,
  channelId: Snowflake,
  accountId: Snowflake,
  guildId: Snowflake,
  logMessageId: Snowflake,
  logChannelId: Snowflake,
  proxyId: string,
  proxyName: string,
): Promise<Response> {
  return await fetch(`${databaseURL}/messages`, {
    body: JSON.stringify({
      message_id: messageId,
      channel_id: channelId,
      account_id: accountId,
      guild_id: guildId,
      log_channel_id: logChannelId,
      log_message_id: logMessageId,
      proxy_id: proxyId,
      proxy_name: proxyName,
    }),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${databaseAuthToken}`,
      'Content-Type': 'application/json',
    },
  })
}

async function getMessageFromDatabase(
  messageId: Snowflake,
  channelId: Snowflake,
): Promise<storedMessageData | null> {
  const resp = await fetch(
    `${databaseURL}/messages?message_id=eq.${messageId}&channel_id=eq.${channelId}` +
      '&select=*,message_id::text,channel_id::text,account_id::text,guild_id::text,log_channel_id::text,log_message_id::text,proxy_id,proxy_name',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${databaseAuthToken}`,
      },
    },
  )
  const data = (await resp.json()) as storedMessageData[]
  if (resp.ok) {
    if (data.length === 0) {
      return null
    } else if (data.length === 1) {
      return data[0]
    } else {
      throw new Error(
        'There were more than 1 messages with the same channel_id and message_id',
      )
    }
  } else {
    if (resp.status >= 500 && resp.status <= 600) {
      throw new ReturnedError(
        'The database service could not be accessed at this time. Please contact the developer',
      )
    }
    const errorData = data as any
    throw new InternalRequestError(errorData.message, resp)
  }
}

export { createMessageInDatabase, getMessageFromDatabase }
