import * as fs from 'fs'
import { Script } from 'vm'

export function loadConfig(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`配置文件不存在: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf8')

  const sandbox: any = {
    module: { exports: {} },
    exports: {}
  }

  const script = new Script(content)
  script.runInNewContext(sandbox)

  return sandbox.module.exports
}