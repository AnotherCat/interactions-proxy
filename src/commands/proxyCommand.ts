import {
  APIApplicationCommandInteraction,
  APIInteractionResponseChannelMessageWithSource,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from 'discord-api-types/v9'
import { InvalidRequest, ReturnedError } from '../errors'
import { getFront } from '../fronts'
import { sendProxyMessage } from '../webhook'
export async function handleProxyCommand(
  interaction: APIApplicationCommandInteraction,
  event: FetchEvent,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  // Check types
  if (
    !interaction.data.options ||
    interaction.data.options[0].type !== ApplicationCommandOptionType.String || // message
    interaction.data.options[1].type !== ApplicationCommandOptionType.String // front id
  ) {
    throw new InvalidRequest('Incorrect options on "proxy" command')
  }
  if (interaction.guild_id === undefined) {
    throw new ReturnedError('This command can only be used in a server!')
  }
  const user = (interaction.user || interaction.member?.user)!
  const frontData = await getFront(user.id, interaction.data.options[1].value)
  if (frontData === null) {
    throw new ReturnedError(
      `The front \`${interaction.data.options[1].value}\`could not be found in the database!`,
    )
  }
  await sendProxyMessage(
    interaction.data.options[0].value,
    frontData.avatarURL,
    frontData.username,
    interaction.channel_id,
    user,
    interaction.data.options[1].value,
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
