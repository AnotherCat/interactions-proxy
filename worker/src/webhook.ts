import {
  APIEmbed,
  APIUser,
  RESTGetAPIChannelWebhooksResult,
  RESTPostAPIWebhookWithTokenWaitResult,
  RESTPostAPIChannelWebhookResult,
  RESTPostAPIWebhookWithTokenJSONBody,
  Snowflake,
  ChannelType,
} from "discord-api-types/v9"
import {
  InternalRequestError,
  MissingPermissions,
  ReturnedError,
} from "./errors"
import {
  DATA_SEPARATOR_CODE,
  logAvatarURL,
  logChannelId,
  logUsername,
  applicationId,
} from "./consts"
import { createMessageInDatabase } from "./pgData"
import { getChannel, makeAPIRequest } from "./discordAPI"
const missingPermissionsMessage =
  "The bot does not have the right permissions in this channel! Please contact your server administrator for more detail. \nNote: this message is cached for 10 minutes"

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
  const webhookData = await getChannelWithWebhook(channel)
  const data: RESTPostAPIWebhookWithTokenJSONBody = {
    content: message,
    username: name,
    avatar_url: avatar,
  }
  const messageData = await retryWebhookOnFail(data, webhookData)

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
    pronouns,
  )
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
    title: "Jump to message",
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
    await getChannelWithWebhook(logChannelId),
  )
}

async function retryWebhookOnFail(
  data: RESTPostAPIWebhookWithTokenJSONBody,
  channel: Channel,
): Promise<RESTPostAPIWebhookWithTokenWaitResult> {
  const messageData = await executeWebhook(data, channel).catch(async function (
    error,
  ) {
    if (error instanceof InternalRequestError) {
      if (error.response.status === 404) {
        channel = await handleWebhookNotFound(channel)
        await executeWebhook(data, channel)
      } else {
        const textBody = await error.response.text()
        let jsonBody = null
        try {
          jsonBody = JSON.parse(textBody)
        } catch (error) {}
        if (
          error.response.status === 400 &&
          jsonBody !== null &&
          "username" in jsonBody
        ) {
          throw new ReturnedError(
            "The username was rejected by discord, please update the username for this front." +
              `\nError: ${jsonBody.username}`,
          )
        } else {
          throw new ReturnedError(
            `Proxying failed with the status \`${error.response.status}\` and the error\`${textBody}\`` +
              "\nPlease copy this error and contact the developer with the error.",
          )
        }
      }
    }
  })
  return messageData!
}

async function executeWebhook(
  data: RESTPostAPIWebhookWithTokenJSONBody,
  channel: Channel,
): Promise<RESTPostAPIWebhookWithTokenWaitResult> {
  let threadQueryString = ""
  if (channel.thread) {
    threadQueryString = `&thread_id=${channel.thread_id}`
  }
  const webhookURL = `https://discord.com/api/webhooks/${channel.webhook_id}/${channel.token}?wait=true${threadQueryString}`
  const resp = await fetch(webhookURL, {
    body: JSON.stringify(data),
    method: "POST",
    headers: { "content-type": "application/json" },
  })
  if (!resp.ok) {
    throw new InternalRequestError(
      `Proxying your message failed with the status code ${resp.status}`,
      resp,
    )
  }
  return resp.json()
}

// webhook stored in the format. Key: "webhook${separatorCharacter}channelid" Data: JSON ChannelStored
// missing permissions stored in the format. Key: "invalid${separatorCharacter}webhook${separatorCharacter}channelid" Data: "null", expires in 10mins

async function handleWebhookNotFound(channel: Channel): Promise<Channel> {
  const WebhookChannelId = channel.thread ? channel.parent_id : channel.id
  const channelId = channel.thread ? channel.thread_id : channel.id
  await DATA_KV.delete(`channel${separatorCharacter}${WebhookChannelId}`)
  return await getChannelWithWebhook(channelId)
}

async function checkCachedMissingPermissions(
  channel: Snowflake,
): Promise<boolean> {
  const resp = await DATA_KV.get(
    `invalid${separatorCharacter}channel${separatorCharacter}${channel}`,
  )
  if (resp === null) {
    return false
  } else {
    return true
  }
}
interface WebhookWithToken {
  token: string
  id: string
}

interface StandardChannel {
  id: Snowflake
  thread: false
  token: string
  webhook_id: Snowflake
}

interface ThreadChannelStored {
  thread: true
  parent_id: Snowflake
}

interface ThreadChannel {
  thread: true
  token: string
  webhook_id: Snowflake
  thread_id: Snowflake
  parent_id: Snowflake
}

interface StandardChannelWithoutWebhook {
  thread: false
}

type ChannelStored = ThreadChannelStored | StandardChannel
type PartialChannelWithoutWebhook =
  | StandardChannelWithoutWebhook
  | ThreadChannelStored
type Channel = ThreadChannel | StandardChannel

async function getThreadWebhook(
  parentId: Snowflake,
  threadId: Snowflake,
): Promise<Channel> {
  let parentChannelRawData = await DATA_KV.get(`channel:${parentId}`)

  if (parentChannelRawData) {
    let parentChannelData
    try {
      parentChannelData = JSON.parse(parentChannelRawData) as StandardChannel
    } catch (e) {
      throw new Error("Could not parse data from KV!")
    }
    return {
      thread: true,
      thread_id: threadId,
      token: parentChannelData.token,
      webhook_id: parentChannelData.webhook_id,
      parent_id: parentId,
    }
  } else {
    let getWebhookResp = await getChannelWebhooks(parentId)
    if (getWebhookResp === null) {
      getWebhookResp = await createChannelWebhook(parentId)
    }
    await DATA_KV.put(
      `channel${separatorCharacter}${parentId}`,
      JSON.stringify({
        thread: false,
        webhook_id: getWebhookResp.id,
        token: getWebhookResp.token,
      }),
    )
    return {
      thread: true,
      webhook_id: getWebhookResp.id,
      token: getWebhookResp.token,
      thread_id: threadId,
      parent_id: parentId,
    }
  }
}

async function getChannelWithWebhook(channelId: Snowflake): Promise<Channel> {
  if (await checkCachedMissingPermissions(channelId)) {
    throw new MissingPermissions(missingPermissionsMessage)
  }
  const data = await DATA_KV.get(`channel${separatorCharacter}${channelId}`)
  if (data) {
    let channelData: ChannelStored
    try {
      channelData = JSON.parse(data) as ChannelStored
    } catch (e) {
      throw new Error("Could not parse data from KV!")
    }
    if (channelData.thread) {
      return await getThreadWebhook(channelData.parent_id, channelId)
    } else {
      return channelData
    }
  } else {
    let partialChannelData: PartialChannelWithoutWebhook
    try {
      const getChannelResp = await getChannel(channelId)
      if (
        getChannelResp.type === ChannelType.GuildText ||
        getChannelResp.type === ChannelType.GuildNews
      ) {
        partialChannelData = {
          thread: false,
        }
      } else if (
        (getChannelResp.type === ChannelType.GuildPrivateThread ||
          getChannelResp.type === ChannelType.GuildPublicThread ||
          getChannelResp.type === ChannelType.GuildNewsThread) &&
        getChannelResp.parent_id
      ) {
        partialChannelData = {
          thread: true,
          parent_id: getChannelResp.parent_id!,
        }
      } else {
        throw new ReturnedError(
          "That channel is not a text channel or a thread channel!",
        )
      }
    } catch (error) {
      if (
        error instanceof InternalRequestError &&
        error.response.status == 403
      ) {
        await DATA_KV.put(
          `invalid${separatorCharacter}channel${separatorCharacter}${channelId}`,
          "null",
          {
            expirationTtl: 600,
          },
        )
        throw new MissingPermissions(missingPermissionsMessage)
      } else throw error
    }
    if (partialChannelData.thread) {
      await DATA_KV.put(
        `channel${separatorCharacter}${channelId}`,
        JSON.stringify(partialChannelData),
      )
      return await getThreadWebhook(partialChannelData.parent_id, channelId)
    } else {
      let getWebhookResp = await getChannelWebhooks(channelId)
      if (getWebhookResp === null) {
        getWebhookResp = await createChannelWebhook(channelId)
      }
      await DATA_KV.put(
        `channel${separatorCharacter}${channelId}`,
        JSON.stringify({
          thread: false,
          webhook_id: getWebhookResp.id,
          token: getWebhookResp.token,
        }),
      )
      return {
        id: channelId,
        thread: false,
        webhook_id: getWebhookResp.id,
        token: getWebhookResp.token,
      }
    }
  }
}

async function getChannelWebhooks(
  channel: Snowflake,
): Promise<WebhookWithToken | null> {
  const getWebhookResponse = await makeAPIRequest(
    `/channels/${channel}/webhooks`,
    {
      method: "GET",
    },
  )
  if (
    (getWebhookResponse.headers.get("Content-Type") || "") !==
      "application/json" ||
    getWebhookResponse.status !== 200
  ) {
    await DATA_KV.put(
      `invalid${separatorCharacter}channel${separatorCharacter}${channel}`,
      "null",
      {
        expirationTtl: 600,
      },
    )
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
  const createWebhookResponse = await makeAPIRequest(
    `/channels/${channel}/webhooks`,
    {
      method: "POST",
      data: {
        name: "Proxy Webhook",
      },
    },
  )
  const responseBody: RESTPostAPIChannelWebhookResult =
    await createWebhookResponse.json()
  if (
    (createWebhookResponse.headers.get("Content-Type") || "") !==
      "application/json" ||
    createWebhookResponse.status !== 200 ||
    responseBody.token == undefined
  ) {
    await DATA_KV.put(
      `invalid${separatorCharacter}channel${separatorCharacter}${channel}`,
      "null",
      { expirationTtl: 600 },
    )
    throw new MissingPermissions(missingPermissionsMessage)
  }
  return { token: responseBody.token, id: responseBody.id }
}
