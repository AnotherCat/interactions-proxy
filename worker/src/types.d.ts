// set secrets with wrangler secret put {name}
export {}

declare global {
  // Public Interaction Secret
  const publicSecurityKey: string
  // Bot Token
  const botToken: string
  // URL of the tunnel connected to the database
  const databaseURL: string
  // Postgrest authorization token
  const databaseAuthToken: string
  const DATA_KV: KVNamespace
}
