import { handleRequest } from './handler'
import {
  InternalRequestError,
  InvalidRequest,
  MissingPermissions,
  ReturnedError,
} from './errors'
import { MessageFlags } from 'discord-api-types/v9'

addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event).catch(function (error) {
      if (error instanceof InvalidRequest) {
        return new Response(error.message, { status: 400 })
      } else if (
        error instanceof MissingPermissions ||
        error instanceof ReturnedError ||
        error instanceof InternalRequestError
      ) {
        let message: string
        if (
          error instanceof MissingPermissions ||
          error instanceof ReturnedError
        ) {
          message = error.message
        } else {
          message = `An error occurred when making a request. Status: ${error.response.status} Error: ${error.message}. \nPlease report this so it can be fixed`
        }

        return new Response(
          JSON.stringify({
            type: 4,
            data: {
              content: message,
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
        throw error
      }
    }),
  )
})
