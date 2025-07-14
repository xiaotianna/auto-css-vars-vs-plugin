// src/utils/writeCssVars.ts
import * as fs from 'fs'
import * as path from 'path'

export function writeCssVar(filePath: string, varName: string, newValue: string) {
  const fullPath = path.resolve(filePath)
  let content = fs.readFileSync(fullPath, 'utf-8')

  // 正则替换 CSS 变量值
  const regex = new RegExp(`(${varName}\\s*:\\s*)[^;]+`)
  if (regex.test(content)) {
    content = content.replace(regex, `$1${newValue}`)
  } else {
    // 如果变量不存在，可以选择追加或忽略
    content += `\n  ${varName}: ${newValue};`
  }

  fs.writeFileSync(fullPath, content, 'utf-8')
}