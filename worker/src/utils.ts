import {
  Snowflake,
  APIInteractionResponse,
  APIInteraction,
  RESTPatchAPIInteractionOriginalResponseJSONBody,
} from 'discord-api-types/v9'
import {
  InternalRequestError,
  MissingPermissions,
  ReturnedError,
} from './errors'

function makeJSONResponse(body: APIInteractionResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeMessageURL(
  guildId: Snowflake,
  messageId: Snowflake,
  channelId: Snowflake,
): string {
  return `https://discord.com/channels/${guildId}/${messageId}/${channelId}`
}

async function executeDeferredInteractionHandleErrors(
  f: Promise<RESTPatchAPIInteractionOriginalResponseJSONBody>,
  interaction: APIInteraction,
): Promise<void> {
  let data: RESTPatchAPIInteractionOriginalResponseJSONBody
  try {
    data = await f
  } catch (error) {
    if (error instanceof MissingPermissions || error instanceof ReturnedError) {
      await updateInteractionResponse(
        {
          content: error.message,
        },
        interaction,
      )
    }
    return
  }
  await updateInteractionResponse(data, interaction)
  return
}

async function updateInteractionResponse(
  body: RESTPatchAPIInteractionOriginalResponseJSONBody,
  interaction: APIInteraction,
): Promise<void> {
  const data = await fetch(
    `https://discord.com/api/v9/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    {
      body: JSON.stringify(body),
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
  if (!data.ok) {
    throw new InternalRequestError(await data.text(), data)
  }
}

export {
  makeJSONResponse,
  makeMessageURL,
  executeDeferredInteractionHandleErrors,
  updateInteractionResponse,
}
