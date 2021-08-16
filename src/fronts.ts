import { Snowflake } from 'discord-api-types/v9'
import { DATA_SEPARATOR_CODE } from './consts'

interface FrontType {
  avatarURL: string
  username: string
  accountId: Snowflake
  // the front id
  id: string
}

const separatorCharacter = String.fromCharCode(DATA_SEPARATOR_CODE)

// fronts are stored in the format. Key: "front${separatorCharacter}${accountid}${separatorCharacter}${frontid}" Value: "${avatarurl}${separatorCharacter}${username}"

async function getFront(
  accountId: Snowflake,
  id: string,
): Promise<FrontType | null> {
  const data = await DATA_KV.get(
    `front${separatorCharacter}${accountId}${separatorCharacter}${id}`,
  )
  if (data === null) {
    return null
  } else {
    const splitData = data.split(separatorCharacter)
    return {
      avatarURL: splitData[0],
      username: splitData[1],
      accountId: accountId,
      id: id,
    }
  }
}

async function listFronts(accountId: Snowflake): Promise<string[] | null> {
  const { keys } = await DATA_KV.list({
    prefix: `front${separatorCharacter}${accountId}`,
  })
  const processedFronts: string[] = []
  for (let index = 0; index < keys.length; index++) {
    const { name } = keys[index]
    processedFronts.push(name)
  }
  if (processedFronts.length === 0) {
    return null
  }
  return processedFronts
}

async function addFront(front: FrontType): Promise<void> {
  await DATA_KV.put(
    `front${separatorCharacter}${front.accountId}${separatorCharacter}${front.id}`,
    `${front.avatarURL}${separatorCharacter}${front.username}`,
  )
}

async function removeFront(accountId: Snowflake, id: string): Promise<void> {
  await DATA_KV.delete(
    `front${separatorCharacter}${accountId}${separatorCharacter}${id}`,
  )
}

export { listFronts, getFront, removeFront, addFront }
