
import 'dotenv/config'


export function env(name: string): string | undefined {  
  const v = process.env[name]
  if (!v) console.error(`Missing env: ${name}`)
  return v
}

