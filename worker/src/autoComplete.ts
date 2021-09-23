import { APIUser, ApplicationCommandOptionType } from "discord-api-types"
import { InvalidRequest } from "./errors"
import { listFronts } from "./fronts"

const handleIdentifier = async (
  option: AutocompleteOption,
  user: APIUser,
): Promise<Record<string, any>> => {
  // Promise<APIInteractionResponse> => { TODO update this when discord-api-types releases
  const ids = await listFronts(user.id)
  const mappedIds = ids
    ? ids.map((id) => {
        return {
          name: id,
          value: id,
        }
      })
    : null

  const IdsToReturn = mappedIds?.filter(
    (id) => option.value === "" || id.value.startsWith(option.value),
  ) // TODO - fix this once discord-api-types is out
  console.log(
    JSON.stringify({
      type: 8,
      data: {
        choices: IdsToReturn,
      },
    }),
  )
  return {
    type: 8,
    data: {
      choices: IdsToReturn,
    },
  }
}

interface AutocompleteOption {
  type: ApplicationCommandOptionType.String
  name: string
  value: any
  focused: boolean
}

const handleManageFrontsAutocomplete = async (
  interaction: any,
): Promise<Record<string, any>> => {
  // Promise<APIInteractionResponse> => { TODO update this when discord-api-types releases
  if (
    !interaction.data.options ||
    interaction.data.options[0].type !== ApplicationCommandOptionType.Subcommand
  ) {
    throw new InvalidRequest(
      'Incorrect options on "manage-fronts" autocomplete',
    )
  }
  if (
    interaction.data.options[0].name !== "get" &&
    interaction.data.options[0].name !== "delete"
  ) {
    throw new InvalidRequest(
      "Invalid subcommand for 'manage-fronts' autocomplete",
    )
  }
  console.log(JSON.stringify(interaction.data.options[0].options))
  const focusedOptions = interaction.data.options[0].options.filter(
    (option: AutocompleteOption) => option.focused,
  )
  console.log(JSON.stringify(focusedOptions))
  if (focusedOptions.length > 1 || focusedOptions.length === 0) {
    throw new InvalidRequest("There must be one focused option!")
  }
  return await handleIdentifier(
    focusedOptions[0] as AutocompleteOption,
    (interaction.user || interaction.member.user)!,
  )
}

const handleProxyAutocomplete = async (
  interaction: any,
): Promise<Record<string, any>> => {
  // Promise<APIInteractionResponse> => { TODO update this when discord-api-types releases
  console.log(JSON.stringify(interaction.data.options))
  const focusedOptions = interaction.data.options.filter(
    (option: AutocompleteOption) => option.focused,
  )
  console.log(JSON.stringify(focusedOptions))
  if (focusedOptions.length > 1 || focusedOptions.length === 0) {
    throw new InvalidRequest("There must be one focused option!")
  }
  return await handleIdentifier(
    focusedOptions[0] as AutocompleteOption,
    (interaction.user || interaction.member.user)!,
  )
}

const handleAutocomplete = async (
  interaction: any,
): Promise<Record<string, any>> => {
  // Promise<APIInteractionResponse> => { TODO update this when discord-api-types releases
  switch (interaction.data.name) {
    case "manage-fronts":
      return handleManageFrontsAutocomplete(interaction)
    case "proxy":
      return handleProxyAutocomplete(interaction)
    default:
      throw new InvalidRequest("That application command was not found")
  }
}

export { handleAutocomplete }
