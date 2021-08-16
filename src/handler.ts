import {
  APIInteraction,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v9'
import { handleCommands } from './commands'
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
  /*
  return new Response(
    JSON.stringify({ type: InteractionResponseType.ChannelMessageWithSource, data: {content: JSON.stringify(interaction)} }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
  */

  switch (interaction.type) {
    case InteractionType.Ping:
      return new Response(
        JSON.stringify({ type: InteractionResponseType.Pong }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
    case InteractionType.ApplicationCommand:
      return new Response(
        JSON.stringify(await handleCommands(interaction, event)),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
    default:
      return new Response('invalid request', { status: 400 })
  }
}
