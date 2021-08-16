import {
  APIApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  ApplicationCommandInteractionDataOptionSubCommand,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from 'discord-api-types/v9'
import { InvalidRequest } from '../errors'
import { addFront, getFront, listFronts, removeFront } from '../fronts'
import { DATA_SEPARATOR_CODE } from '../consts'

const separatorCharacter = String.fromCharCode(DATA_SEPARATOR_CODE)

export async function handleManageFrontsCommand(
  interaction: APIApplicationCommandInteraction,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  if (
    !interaction.data.options ||
    interaction.data.options[0].type !== ApplicationCommandOptionType.Subcommand
  ) {
    throw new InvalidRequest('Incorrect options on "manage-fronts" command')
  }
  console.log(interaction.data.options[0].name)
  switch (interaction.data.options[0].name) {
    case 'register':
      return await handleRegisterCommand(interaction)
    case 'list':
      return await handleListCommand(interaction)
    case 'get':
      return await handleGetCommand(interaction)
    case 'delete':
      return await handleDeleteCommand(interaction)
    default:
      throw new InvalidRequest('That application command was not found')
  }
}
async function handleDeleteCommand(
  interaction: APIApplicationCommandInteraction,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  const user = (interaction.user || interaction.member?.user)!
  const { options } = interaction.data
    .options![0] as ApplicationCommandInteractionDataOptionSubCommand
  if (
    options.length === 0 ||
    options[0].type != ApplicationCommandOptionType.String // identifier
  ) {
    throw new InvalidRequest(
      'Incorrect options on "manage-fronts register" command',
    )
  }
  const frontId = options[0].value
  const front = await getFront(user.id, frontId)
  let message = ''
  if (front === null) {
    message = `The front \`${frontId}\` has not be registered yet!`
  } else {
    await removeFront(user.id, frontId)
    message =
      'Front successfully removed!' +
      "\nHere's the data just in case you need it:" +
      `\nFront ID: \`${front.id}\`` +
      `\nUsername: \`${front.username}\`` +
      `\nAvatar URL: \`${front.avatarURL}\``
  }
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: message,
      flags: MessageFlags.Ephemeral,
    },
  }
}

async function handleListCommand(
  interaction: APIApplicationCommandInteraction,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  const user = (interaction.user || interaction.member?.user)!
  const fronts = await listFronts(user.id)
  let message = ''
  if (fronts === null) {
    message = 'There are no fronts registered under this account!'
  } else {
    message = 'Fronts: `'
    for (let index = 0; index < fronts.length; index++) {
      message = message.concat(`${fronts[index]}\``)
      if (index !== fronts.length - 1) {
        message = message.concat(', `')
      }
    }
  }
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: message,
      flags: MessageFlags.Ephemeral,
    },
  }
}

async function handleRegisterCommand(
  interaction: APIApplicationCommandInteraction,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  const { options } = interaction.data
    .options![0] as ApplicationCommandInteractionDataOptionSubCommand
  if (
    options.length === 0 ||
    options[0].type != ApplicationCommandOptionType.String || // identifer
    options[1].type != ApplicationCommandOptionType.String || // username
    options[2].type != ApplicationCommandOptionType.String // avatar-url
  ) {
    throw new InvalidRequest(
      'Incorrect options on "manage-fronts register" command',
    )
  }
  const user = (interaction.user || interaction.member?.user)!
  const existingFronts = await getFront(user.id, options[0].value)
  const frontData = {
    username: options[1].value,
    avatarURL: options[2].value,
    id: options[0].value,
    accountId: user.id,
  }
  if (
    frontData.username.includes(separatorCharacter) ||
    frontData.id.includes(separatorCharacter) ||
    frontData.avatarURL.includes(separatorCharacter)
  ) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `The record separator character (\`${separatorCharacter}}\`) was in one of the values! This cannot be used because it interferers with internal workings.`,
        flags: MessageFlags.Ephemeral,
      },
    }
  }

  if (existingFronts != null) {
    if (
      existingFronts.avatarURL === frontData.avatarURL &&
      existingFronts.username === frontData.username &&
      existingFronts.accountId === frontData.accountId &&
      existingFronts.id === frontData.id
    ) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `The front \`${frontData.id}\` already exists with the same data!`,
          flags: MessageFlags.Ephemeral,
        },
      }
    } else {
      await addFront(frontData)
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `The front \`${frontData.id}\` has been updated!`,
          flags: MessageFlags.Ephemeral,
        },
      }
    }
  } else {
    await addFront(frontData)
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `The front \`${frontData.id}\` has been created!`,
        flags: MessageFlags.Ephemeral,
      },
    }
  }
}

async function handleGetCommand(
  interaction: APIApplicationCommandInteraction,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  const { options } = interaction.data
    .options![0] as ApplicationCommandInteractionDataOptionSubCommand
  if (
    options.length === 0 ||
    options[0].type != ApplicationCommandOptionType.String // identifer
  ) {
    throw new InvalidRequest('Incorrect options on "manage-fronts get" command')
  }
  const user = (interaction.user || interaction.member?.user)!
  const existingFronts = await getFront(user.id, options[0].value)
  let message = ''
  if (existingFronts === null) {
    message = `The front with the id \`${options[0].value}\` hasn't been created yet!`
  } else {
    message = `Front id: \`${existingFronts.id}\`\nUsername: \`${existingFronts.username}\`\nAvatar URL: \`${existingFronts.avatarURL}\``
  }
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: message,
      flags: MessageFlags.Ephemeral,
    },
  }
}
