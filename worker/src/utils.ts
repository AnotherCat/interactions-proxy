import {
  Snowflake,
  APIInteractionResponse,
  APIInteraction,
  RESTPatchAPIInteractionOriginalResponseJSONBody,
} from "discord-api-types/v9"
import { makeAPIRequest } from "./discordAPI"
import {
  InternalRequestError,
  MissingPermissions,
  ReturnedError,
} from "./errors"

function makeJSONResponse(body: APIInteractionResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
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
      try {
        await updateInteractionResponse(
          {
            content: error.message,
          },
          interaction,
        )
      } catch (e) {
        console.error(e)
      }
    } else if (error instanceof InternalRequestError) {
      await updateInteractionResponse(
        {
          content: `An error occurred when making a request. Status: ${error.response.status} Error: ${error.message}. \nPlease report this so it can be fixed`,
        },
        interaction,
      )
    } else {
      throw error
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
  const data = await makeAPIRequest(
    `/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    {
      data: body,
      method: "PATCH",
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
