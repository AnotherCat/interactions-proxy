import {
  APIApplicationCommandInteraction,
  APIInteractionResponseChannelMessageWithSource,
} from 'discord-api-types/v9'
import { InvalidRequest } from '../errors'
import { handleProxyCommand } from './proxyCommand'
import { handleManageFrontsCommand } from './manageFrontsCommand'
export async function handleCommands(
  interaction: APIApplicationCommandInteraction,
  event: FetchEvent,
): Promise<APIInteractionResponseChannelMessageWithSource> {
  console.log(interaction.data.name)
  switch (interaction.data.name) {
    case 'proxy':
      return await handleProxyCommand(interaction, event)
    case 'manage-fronts':
      return await handleManageFrontsCommand(interaction)
    default:
      throw new InvalidRequest('That application command was not found')
  }
}
