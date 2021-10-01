import {
  APIEmbed,
  APIEmbedFooter,
  APIEmbedAuthor,
  RESTPatchAPIInteractionOriginalResponseJSONBody,
  APIMessage,
  ApplicationCommandOptionType,
  APIChatInputApplicationCommandInteraction,
  APIMessageApplicationCommandInteraction,
  ApplicationCommandInteractionDataOptionSubCommand,
} from "discord-api-types/v9"
import {
  applicationId,
  logAvatarURL,
  logChannelId,
  logUsername,
  modRoleId,
} from "../consts"
import { InternalRequestError, InvalidRequest, ReturnedError } from "../errors"
import { getFront } from "../fronts"
import { getMessageFromDatabase, markMessageDeleted } from "../pgData"
import { getMessage, getUser, sendDMMessage } from "../discordAPI"
import { makeMessageURL } from "../utils"
import {
  deleteWebhookMessage,
  editWebhookMessage,
  getChannelWithWebhook,
  retryWebhookOnFail,
} from "../webhook"

async function handleMessageSlashCommand(
  interaction: APIChatInputApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  if (
    !interaction.data.options ||
    interaction.data.options[0].type !== ApplicationCommandOptionType.Subcommand
  ) {
    throw new InvalidRequest('Incorrect options on "manage-fronts" command')
  }
  switch (interaction.data.options[0].name) {
    case "edit":
      return await handleEditMessageSlashCommand(interaction)
    case "info":
      return await handleGetMessageInfoSlashCommand(interaction)
    case "delete":
      return await handleDeleteMessageSlashCommand(interaction)
    default:
      throw new InvalidRequest("That application command was not found")
  }
}

async function handleGetMessageInfoSlashCommand(
  interaction: APIChatInputApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  const { options } = interaction.data
    .options![0] as ApplicationCommandInteractionDataOptionSubCommand
  if (
    !options ||
    options[0].type !== ApplicationCommandOptionType.Channel || // channel
    options[1].type !== ApplicationCommandOptionType.String // message id
  ) {
    throw new InvalidRequest('Incorrect options on "proxy" command')
  }
  if (interaction.guild_id === undefined) {
    throw new ReturnedError("This command can only be used in a server!")
  }
  let message: APIMessage
  try {
    message = await getMessage(options[0].value, options[1].value)
  } catch (error) {
    if (error instanceof InternalRequestError) {
      switch (error.response.status) {
        case 403:
          return {
            content:
              "I do not have the required permissions in that channel! Please contact the server administrator",
          }
        case 404:
          return {
            content: "That message could not be found!",
          }
        default:
          throw error
      }
    } else {
      throw error
    }
  }
  return await handleGetMessageInfoCommand(interaction, message)
}
async function handleGetMessageInfoMessageCommand(
  interaction: APIMessageApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  const message = interaction.data.resolved.messages[interaction.data.target_id]
  return await handleGetMessageInfoCommand(interaction, message)
}

async function handleGetMessageInfoCommand(
  interaction:
    | APIMessageApplicationCommandInteraction
    | APIChatInputApplicationCommandInteraction,
  message: APIMessage,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  if (!interaction.guild_id) {
    throw new ReturnedError("This command cannot be used in a dm")
  }
  const user = (interaction.user || interaction.member?.user)!
  if (message.webhook_id === undefined) {
    return {
      content: "This message was not proxyed through this bot!",
    }
  }
  const messageData = await getMessageFromDatabase(
    message.id,
    message.channel_id,
  )
  if (!messageData) {
    return {
      content: "This message could not be found in the database!",
    }
  }
  let extraMessage = "\n"
  if (interaction.member!.roles.includes(modRoleId)) {
    extraMessage = `\n**[Jump to log message](${makeMessageURL(
      messageData.guild_id,
      messageData.log_channel_id,
      messageData.log_message_id,
    )})** | `
  }

  const account = await getUser(messageData.account_id)

  const proxyData = await getFront(messageData.account_id, messageData.proxy_id)
  let author: APIEmbedAuthor
  if (proxyData) {
    author = {
      name: `Front: ${messageData.proxy_name} (${messageData.proxy_id})`,
      icon_url: proxyData.avatarURL,
    }
  } else {
    author = {
      name: `Front: ${messageData.proxy_name} (${messageData.proxy_id})`,
    }
  }
  let footer: APIEmbedFooter

  if (account) {
    footer = {
      text: `${account.username}#${account.discriminator} (${account.id})`,
      icon_url: `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png?size=32`,
    }
  } else {
    footer = {
      text: "Account not found",
    }
  }
  let pronounMessage = ""
  if (messageData.proxy_pronouns) {
    pronounMessage = `\n**Pronouns:** ${messageData.proxy_pronouns}`
  }
  const embed: APIEmbed = {
    title: "Message Information",
    description:
      `**Channel:** <#${messageData.channel_id}>` +
      `\n**Message:** ${messageData.message_id}` +
      extraMessage +
      `**[Jump to message](${makeMessageURL(
        messageData.guild_id,
        messageData.channel_id,
        messageData.message_id,
      )})**` +
      `\n**Click to open profile:** <discord://-/users/${messageData.account_id}>` +
      pronounMessage +
      `\n**Content:** ${message.content}`,
    author: author,
    footer: footer,
    color: 3066993,
  }
  const sendDMMessageResult = await sendDMMessage(user.id, null, embed)
  let responseMessage: string
  if (!sendDMMessageResult) {
    responseMessage =
      "Could not send you a dm! Please check your dm privacy settings!"
  } else {
    responseMessage = "Sent you a dm with the relevant information"
  }
  return {
    content: responseMessage,
  }
}

async function handleGetMessageQuickInfoCommand(
  interaction: APIMessageApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  const message = interaction.data.resolved.messages[interaction.data.target_id]
  if (!interaction.guild_id) {
    throw new ReturnedError("This command cannot be used in a dm")
  }
  const user = (interaction.user || interaction.member?.user)!
  if (message.webhook_id === undefined) {
    return {
      content: "This message was not proxyed through this bot!",
    }
  }
  const messageData = await getMessageFromDatabase(
    message.id,
    message.channel_id,
  )
  if (!messageData) {
    return {
      content: "This message could not be found in the database!",
    }
  }
  return {
    content: `The author account of [this message](${makeMessageURL(
      messageData.guild_id,
      messageData.channel_id,
      messageData.message_id,
    )}) is <@${messageData.account_id}> \`<@${
      messageData.account_id
    }>\` (copy and paste to ping)`,
  }
}

async function handleDeleteMessageSlashCommand(
  interaction: APIChatInputApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  const { options } = interaction.data
    .options![0] as ApplicationCommandInteractionDataOptionSubCommand
  if (
    !options ||
    options[0].type !== ApplicationCommandOptionType.Channel || // channel
    options[1].type !== ApplicationCommandOptionType.String // message id
  ) {
    throw new InvalidRequest('Incorrect options on "proxy" command')
  }
  if (interaction.guild_id === undefined) {
    throw new ReturnedError("This command can only be used in a server!")
  }
  let message: APIMessage
  try {
    message = await getMessage(options[0].value, options[1].value)
  } catch (error) {
    if (error instanceof InternalRequestError) {
      switch (error.response.status) {
        case 403:
          return {
            content:
              "I do not have the required permissions in that channel! Please contact the server administrator",
          }
        case 404:
          return {
            content: "That message could not be found!",
          }
        default:
          throw error
      }
    } else {
      throw error
    }
  }
  return await handleDeleteMessageCommand(interaction, message)
}

async function handleDeleteMessageMessageCommand(
  interaction: APIMessageApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  const message = interaction.data.resolved.messages[interaction.data.target_id]
  return await handleDeleteMessageCommand(interaction, message)
}

async function handleDeleteMessageCommand(
  interaction:
    | APIMessageApplicationCommandInteraction
    | APIChatInputApplicationCommandInteraction,
  message: APIMessage,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  if (!interaction.guild_id) {
    throw new ReturnedError("This command cannot be used in a dm")
  }
  const user = (interaction.user || interaction.member?.user)!
  if (message.webhook_id === undefined) {
    return {
      content: "This message was not proxyed through this bot!",
    }
  }
  const messageData = await getMessageFromDatabase(
    message.id,
    message.channel_id,
  )
  if (!messageData) {
    return {
      content: "This message could not be found in the database!",
    }
  }
  if (messageData.account_id !== user.id) {
    return {
      content: "You must be the author of this message to delete it!",
    }
  }
  try {
    await deleteWebhookMessage(interaction.channel_id, message.id)
  } catch (e) {
    if (!(e instanceof InternalRequestError)) throw e
    return {
      content:
        "Deleting that message failed. Please contact a moderator to remove it",
    }
  }
  const proxyData = await getFront(messageData.account_id, messageData.proxy_id)
  const embed: APIEmbed = {
    title: "Message Deleted",
    author: {
      icon_url: proxyData ? proxyData.avatarURL : undefined,
      name: `Front: ${messageData.proxy_name} (${messageData.proxy_id})`,
    },
    description:
      `Message ${message.id} deleted from <#${message.channel_id}>` +
      `\n**Content:** ${message.content}` +
      `\n**Click to open profile:** <discord://-/users/${user.id}>`,
    footer: {
      text: `${user.username}#${user.discriminator} (${user.id})`,
      icon_url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`,
    },
    color: 15869459,
    timestamp: new Date(Date.now()).toISOString(),
  }
  await markMessageDeleted(message.id, message.channel_id)
  await retryWebhookOnFail(
    {
      embeds: [embed],
      username: logUsername,
      avatar_url: logAvatarURL,
    },
    await getChannelWithWebhook(logChannelId),
  )
  return {
    content: `Message deleted!`,
  }
}

async function handleEditMessageSlashCommand(
  interaction: APIChatInputApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  if (!interaction.guild_id) {
    throw new ReturnedError("This command cannot be used in a dm")
  }
  const { options } = interaction.data
    .options![0] as ApplicationCommandInteractionDataOptionSubCommand
  if (
    !options ||
    options[0].type !== ApplicationCommandOptionType.Channel || // channel
    options[1].type !== ApplicationCommandOptionType.String || // message id
    options[2].type !== ApplicationCommandOptionType.String // New content
  ) {
    throw new InvalidRequest('Incorrect options on "proxy" command')
  }
  const newContent = options[2].value
  if (interaction.guild_id === undefined) {
    throw new ReturnedError("This command can only be used in a server!")
  }
  let message: APIMessage
  try {
    message = await getMessage(options[0].value, options[1].value)
  } catch (error) {
    if (error instanceof InternalRequestError) {
      switch (error.response.status) {
        case 403:
          return {
            content:
              "I do not have the required permissions in that channel! Please contact the server administrator",
          }
        case 404:
          return {
            content: "That message could not be found!",
          }
        default:
          throw error
      }
    } else {
      throw error
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = (interaction.user || interaction.member?.user)!
  if (message.webhook_id === undefined) {
    return {
      content: "This message was not proxyed through this bot!",
    }
  }
  const messageData = await getMessageFromDatabase(
    message.id,
    message.channel_id,
  )
  if (!messageData) {
    return {
      content: "This message could not be found in the database!",
    }
  }
  if (messageData.account_id !== user.id) {
    return {
      content: "You must be the author of this message to edit it!",
    }
  }
  try {
    await editWebhookMessage(interaction.channel_id, message.id, newContent)
  } catch (e) {
    if (!(e instanceof InternalRequestError)) throw e
    return {
      content: "Editing that message failed",
    }
  }
  const proxyData = await getFront(messageData.account_id, messageData.proxy_id)
  const embed: APIEmbed = {
    title: "Message Edited",
    author: {
      icon_url: proxyData ? proxyData.avatarURL : undefined,
      name: `Front: ${messageData.proxy_name} (${messageData.proxy_id})`,
    },
    description:
      `Message ${message.id} edited in <#${message.channel_id}>` +
      `\n**New Content:** ${newContent}` +
      `\n**Content:** ${message.content}` +
      `\n**Click to open profile:** <discord://-/users/${user.id}>`,
    footer: {
      text: `${user.username}#${user.discriminator} (${user.id})`,
      icon_url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`,
    },
    color: 16753920,
    timestamp: new Date(Date.now()).toISOString(),
  }
  await retryWebhookOnFail(
    {
      embeds: [embed],
      username: logUsername,
      avatar_url: logAvatarURL,
    },
    await getChannelWithWebhook(logChannelId),
  )
  return {
    content: `Message edited!`,
  }
}

export {
  handleGetMessageInfoMessageCommand,
  handleGetMessageQuickInfoCommand,
  handleDeleteMessageMessageCommand,
  handleMessageSlashCommand,
}
