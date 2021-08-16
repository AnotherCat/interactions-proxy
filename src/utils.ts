import { APIInteractionResponse } from 'discord-api-types/v9'

export function makeJSONResponse(body: APIInteractionResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}
