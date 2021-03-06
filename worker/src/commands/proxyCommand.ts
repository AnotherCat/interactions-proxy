import {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponseChannelMessageWithSource,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v9"
import { InvalidRequest, ReturnedError } from "../errors"
import { checkFiltered } from "../filter"
import { getFront } from "../fronts"
import { sendFilterMessage, sendProxyMessage } from "../webhook"
export async function handleProxyCommand(
  interaction: APIChatInputApplicationCommandInteraction,
  event: FetchEvent,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  // Check types
  if (
    !interaction.data.options ||
    interaction.data.options[0].type !== ApplicationCommandOptionType.String || // front id
    interaction.data.options[1].type !== ApplicationCommandOptionType.String // message
  ) {
    throw new InvalidRequest('Incorrect options on "proxy" command')
  }
  if (interaction.guild_id === undefined) {
    throw new ReturnedError("This command can only be used in a server!")
  }
  const frontId = interaction.data.options[0].value
  const message = interaction.data.options[1].value
  if (message.length > 2000) {
    throw new ReturnedError(
      `Messages must be 2000 characters or less! That message was ${
        message.length - 2000
      } characters above the limit`,
    )
  }
  const user = (interaction.user || interaction.member?.user)!
  const frontData = await getFront(user.id, frontId)
  if (frontData === null) {
    throw new ReturnedError(
      `The front \`${frontId}\`could not be found in the database!`,
    )
  }
  const filterMatch = checkFiltered(message)
  if (filterMatch) {
    await sendFilterMessage(
      message,
      frontData,
      interaction.channel_id,
      user,
      filterMatch,
    )
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "Your message contained filtered words! Please don't do that!",
        flags: MessageFlags.Ephemeral,
      },
    }
  }

  await sendProxyMessage(
    message,
    frontData.avatarURL,
    frontData.username,
    interaction.channel_id,
    user,
    frontId,
    frontData.pronouns,
    event,
    interaction.guild_id,
  )
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Your message was proxied! Please click "Dismiss Message".',
      flags: MessageFlags.Ephemeral,
    },
  }
}
