import { Snowflake } from "discord-api-types/v9"
import { DATA_SEPARATOR_CODE } from "./consts"

interface FrontType {
  avatarURL: string
  username: string
  accountId: Snowflake
  pronouns: string | null
  // the front id
  id: string
}

const separatorCharacter = String.fromCharCode(DATA_SEPARATOR_CODE)

// fronts are stored in the format. Key: "front${separatorCharacter}${accountid}${separatorCharacter}${frontid}" Value: JSON.stringify(FrontType)

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
    try {
      return JSON.parse(data) as FrontType
    } catch (e) {
      throw new Error("Could not parse data from KV!")
    }
  }
}

async function listFronts(accountId: Snowflake): Promise<FrontType[]> {
  const fronts = await DATA_KV.get(`fronts${separatorCharacter}${accountId}`)
  if (fronts === null) {
    return []
  } else {
    try {
      return JSON.parse(fronts) as FrontType[]
    } catch (e) {
      throw new Error("Could not parse data from KV!")
    }
  }
}

async function addFront(
  front: FrontType,
  existingFronts?: FrontType[],
): Promise<void> {
  console.log(JSON.stringify(front))
  if (!existingFronts) existingFronts = await listFronts(front.accountId)
  let allFronts = existingFronts.filter((existingFront) => {
    console.log(existingFront.id !== front.id)
    console.log(JSON.stringify(existingFront))
  })
  allFronts = allFronts.concat([front])

  await DATA_KV.put(
    `front${separatorCharacter}${front.accountId}${separatorCharacter}${front.id}`,
    JSON.stringify(front),
  )
  await DATA_KV.put(
    `fronts${separatorCharacter}${front.accountId}`,
    JSON.stringify(allFronts),
  )
}

async function removeFront(
  accountId: Snowflake,
  id: string,
  existingFronts?: FrontType[],
): Promise<void> {
  if (!existingFronts) existingFronts = await listFronts(accountId)
  const allFronts = existingFronts.filter((front) => front.id !== id)
  await DATA_KV.delete(
    `front${separatorCharacter}${accountId}${separatorCharacter}${id}`,
  )
  await DATA_KV.put(
    `fronts${separatorCharacter}${accountId}`,
    JSON.stringify(allFronts),
  )
}

export { listFronts, getFront, removeFront, addFront }
