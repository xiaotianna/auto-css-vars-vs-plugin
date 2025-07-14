export function extractCssVars(content: string) {
  const vars: Record<string, string> = {}
  const regex = /--[^:\s]+:\s*([^;]+)/g
  let match

  while ((match = regex.exec(content)) !== null) {
    const varName = match[0].split(':')[0].trim()
    const value = match[1].trim()
    vars[varName] = value
  }

  return vars
}