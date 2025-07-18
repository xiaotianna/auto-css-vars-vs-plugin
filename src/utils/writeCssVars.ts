import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

export function writeCssVar(filePath: string, varName: string, newValue: string) {
  const workspaceRootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
  const fullPath = path.join(workspaceRootPath, filePath);
  let content = fs.readFileSync(fullPath, 'utf-8')

  // 正则替换 CSS 变量值
  const regex = new RegExp(`(${varName}\\s*:\\s*)[^;]+`)
  if (regex.test(content)) {
    content = content.replace(regex, `$1${newValue}`)
  } else {
    // 如果变量不存在，可以选择追加或忽略
    content += `\n  ${varName}: ${newValue};`
  }

  try {
    fs.writeFileSync(fullPath, content, 'utf-8')
  } catch (error) {
    vscode.window.showErrorMessage(`文件修改 ${fullPath} 失败：${error}`)
  }
}