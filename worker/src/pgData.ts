import { Snowflake } from 'discord-api-types/v9'
export async function createMessageInDatabase(
  messageId: Snowflake,
  channelId: Snowflake,
  accountId: Snowflake,
  guildId: Snowflake,
  logMessageId: Snowflake,
  logChannelId: Snowflake,
  proxyId: string,
  proxyName: string
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
      proxy_name: proxyName
    }),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${databaseAuthToken}`,
      "Content-Type": "application/json"
    },
  })
}
