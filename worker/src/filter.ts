import { regexFilters, wordFilters } from "./consts"

const checkFiltered = (text: string): string | null => {
  let match: string | null = null

  for (const value of Object.values(regexFilters)) {
    const possibleMatch = text.match(value)
    if (possibleMatch) {
      match = possibleMatch[0]
      break
    }
  }
  if (!match) {
    for (const word of Object.values(wordFilters)) {
      if (text.includes(word)) {
        match = word
        break
      }
    }
  }
  return match
}

export { checkFiltered }
