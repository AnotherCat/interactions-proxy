import {
  APIEmbed,
  APIEmbedFooter,
  APIEmbedAuthor,
  RESTPatchAPIInteractionOriginalResponseJSONBody,
  APIMessage,
  ApplicationCommandOptionType,
} from 'discord-api-types/v9'
import {
  APIChatInputApplicationCommandInteraction,
  APIMessageApplicationCommandInteraction,
} from '../api-types-for-the-timebeing'
import { applicationId, modRoleId } from '../consts'
import { InternalRequestError, InvalidRequest, ReturnedError } from '../errors'
import { getFront } from '../fronts'
import { getMessageFromDatabase } from '../pgData'
import { getMessage, getUser, sendDMMessage } from '../discordAPI'
import { makeMessageURL } from '../utils'

async function handleGetMessageInfoSlashCommand(
  interaction: APIChatInputApplicationCommandInteraction,
): Promise<RESTPatchAPIInteractionOriginalResponseJSONBody> {
  if (
    !interaction.data.options ||
    interaction.data.options[0].type !== ApplicationCommandOptionType.Channel || // channel
    interaction.data.options[1].type !== ApplicationCommandOptionType.String // message id
  ) {
    throw new InvalidRequest('Incorrect options on "proxy" command')
  }
  if (interaction.guild_id === undefined) {
    throw new ReturnedError('This command can only be used in a server!')
  }
  let message: APIMessage
  try {
    message = await getMessage(
      interaction.data.options[0].value,
      interaction.data.options[1].value,
    )
  } catch (error) {
    if (error instanceof InternalRequestError) {
      switch (error.response.status) {
        case 403:
          return {
            content:
              'I do not have the required permissions in that channel! Please contact the server administrator',
          }
        case 404:
          return {
            content: 'That message could not be found!',
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
    throw new ReturnedError('This command cannot be used in a dm')
  }
  const user = (interaction.user || interaction.member?.user)!
  if (message.webhook_id === undefined) {
    return {
      content: 'This message was not proxyed through this bot!',
    }
  }
  const messageData = await getMessageFromDatabase(
    message.id,
    message.channel_id,
  )
  if (!messageData) {
    return {
      content: 'This message could not be found in the database!',
    }
  }
  let extraMessage = '\n'
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
      text: 'Account not found',
    }
  }
  let pronounMessage = ''
  if (messageData.proxy_pronouns) {
    pronounMessage = `\n\**Pronouns:** ${messageData.proxy_pronouns}`
  }
  const embed: APIEmbed = {
    title: 'Message Information',
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
      'Could not send you a dm! Please check your dm privacy settings!'
  } else {
    responseMessage = 'Sent you a dm with the relevant information'
  }
  return {
    content: responseMessage,
  }
}

export { handleGetMessageInfoMessageCommand, handleGetMessageInfoSlashCommand }
