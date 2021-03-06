import {
  APIApplicationCommandInteraction,
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponseChannelMessageWithSource,
  APIInteractionResponseDeferredChannelMessageWithSource,
  APIMessageApplicationCommandInteraction,
  ApplicationCommandType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v9"
import { InvalidRequest } from "../errors"
import { handleProxyCommand } from "./proxyCommand"
import { handleManageFrontsCommand } from "./manageFrontsCommand"
import {
  handleGetMessageInfoMessageCommand,
  handleGetMessageQuickInfoCommand,
  handleDeleteMessageMessageCommand,
  handleMessageSlashCommand,
} from "./messageCommands"

import { executeDeferredInteractionHandleErrors } from "../utils"
export async function handleCommands(
  interaction: APIApplicationCommandInteraction,
  event: FetchEvent,
): Promise<
  | APIInteractionResponseChannelMessageWithSource
  | APIInteractionResponseDeferredChannelMessageWithSource
> {
  switch (interaction.data.type) {
    case ApplicationCommandType.ChatInput:
      switch (interaction.data.name) {
        case "proxy":
          return await handleProxyCommand(
            interaction as APIChatInputApplicationCommandInteraction,
            event,
          )
        case "manage-fronts":
          return await handleManageFrontsCommand(
            interaction as APIChatInputApplicationCommandInteraction,
          )
        case "message":
          event.waitUntil(
            executeDeferredInteractionHandleErrors(
              handleMessageSlashCommand(
                interaction as APIChatInputApplicationCommandInteraction,
              ),
              interaction,
            ),
          )
          return {
            type: InteractionResponseType.DeferredChannelMessageWithSource,
            data: {
              flags: MessageFlags.Ephemeral,
            },
          }
        default:
          throw new InvalidRequest("That application command was not found")
      }
    case ApplicationCommandType.Message:
      switch (interaction.data.name) {
        case "Get Message Info":
          event.waitUntil(
            executeDeferredInteractionHandleErrors(
              handleGetMessageInfoMessageCommand(
                interaction as APIMessageApplicationCommandInteraction,
              ),
              interaction,
            ),
          )
          return {
            type: InteractionResponseType.DeferredChannelMessageWithSource,
            data: {
              flags: MessageFlags.Ephemeral,
            },
          }
        case "Get Message Account":
          event.waitUntil(
            executeDeferredInteractionHandleErrors(
              handleGetMessageQuickInfoCommand(
                interaction as APIMessageApplicationCommandInteraction,
              ),
              interaction,
            ),
          )
          return {
            type: InteractionResponseType.DeferredChannelMessageWithSource,
            data: {
              flags: MessageFlags.Ephemeral,
            },
          }
        case "Delete Message":
          event.waitUntil(
            executeDeferredInteractionHandleErrors(
              handleDeleteMessageMessageCommand(
                interaction as APIMessageApplicationCommandInteraction,
              ),
              interaction,
            ),
          )
          return {
            type: InteractionResponseType.DeferredChannelMessageWithSource,
            data: {
              flags: MessageFlags.Ephemeral,
            },
          }
        default:
          throw new InvalidRequest("That application command was not found")
      }

    default:
      throw new InvalidRequest("That application command type is not handled")
  }
}
