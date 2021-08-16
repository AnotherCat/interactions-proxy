// set secrets with wrangler secret put {name}
export {}

declare global {
  // Public Interaction Secret
  const publicSecurityKey: string
  // Bot Token
  const botToken: string
  // Application Id
  const applicationId: string
  const DATA_KV: KVNamespace
}
