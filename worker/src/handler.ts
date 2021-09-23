import {
  APIApplicationCommandInteraction,
  APIInteraction,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v9'
import { handleAutocomplete } from './autoComplete'
import { handleCommands } from './commands'
import { listFronts } from './fronts'
import { verify } from './security'

export async function handleRequest(event: FetchEvent): Promise<Response> {
  const request = event.request

  if (request.method !== 'POST') {
    return new Response('invalid method', { status: 405 })
  }
  if (!(await verify(request))) {
    return new Response('invalid request', { status: 401 })
  }
  const interaction = (await request.json()) as APIInteraction
  console.log(JSON.stringify(interaction))
  /*
  return new Response(
    JSON.stringify({ type: InteractionResponseType.ChannelMessageWithSource, data: {content: JSON.stringify(interaction)} }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
  */

  switch (
    interaction.type as number // TODO - remove this once discord-api-types adds autocomplete
  ) {
    case InteractionType.Ping:
      return new Response(
        JSON.stringify({ type: InteractionResponseType.Pong }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
    case InteractionType.ApplicationCommand:
      return new Response(
        JSON.stringify(
          await handleCommands(
            interaction as APIApplicationCommandInteraction,
            event,
          ),
        ), // TODO - remove this once discord-api-types adds autocomplete
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
    case 4:
      const resp = await handleAutocomplete(interaction)
      console.log(resp)
      return new Response(JSON.stringify(resp), {
        headers: { 'Content-Type': 'application/json' },
      })
    default:
      return new Response('invalid request', { status: 400 })
  }
}
