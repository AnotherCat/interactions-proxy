import { handleRequest } from './handler'
import { InvalidRequest, MissingPermissions, ReturnedError } from './errors'
import { MessageFlags } from 'discord-api-types/v9'

addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event).catch(function (e) {
      if (e instanceof InvalidRequest) {
        return new Response(e.message, { status: 400 })
      } else if (
        e instanceof MissingPermissions ||
        e instanceof ReturnedError
      ) {
        return new Response(
          JSON.stringify({
            type: 4,
            data: {
              content: e.message,
              flags: MessageFlags.Ephemeral,
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      } else {
        return new Response('internal error', { status: 500 })
      }
    }),
  )
})
