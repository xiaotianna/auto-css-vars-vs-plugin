import * as vscode from 'vscode'
import { ColorVarsWebviewViewProvider } from './provider/ColorVarsWebviewViewProvider'
import { ColorProvider } from './provider/ColorProvider'
import { ColorHoverProvider } from './provider/ColorHoverProvider'
import { replaceColorsInDocument } from './utils/replaceColorsInDocument'
import { ColorCodeActionProvider } from './provider/ColorCodeActionProvider'
import { pickAndReplaceColorVar } from './utils/pickAndReplaceColorVar'

let colorProvider: ColorProvider
let colorVarsWebviewViewProvider: ColorVarsWebviewViewProvider

export function activate(context: vscode.ExtensionContext) {
  colorProvider = new ColorProvider()
  colorVarsWebviewViewProvider = new ColorVarsWebviewViewProvider(
    context.extensionUri
  )

  // 活动侧边栏
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ColorVarsWebviewViewProvider.viewType,
      colorVarsWebviewViewProvider
    )
  )
  // 命令：替换颜色变量
  context.subscriptions.push(
    vscode.commands.registerCommand('auto-css-vars.replaceColors', () => {
      replaceColorsInDocument(colorProvider)
    })
  )
  // 命令：注册颜色变量选择替换命令（顶部命令面板选择列表）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'auto-css-vars.pickAndReplaceColorVar',
      async () => {
        await pickAndReplaceColorVar(colorProvider)
      }
    )
  )
  // 注册hover颜色变量提示
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      ['scss', 'css', 'vue', 'typescript', 'javascript', 'html', 'jsx', 'tsx'],
      new ColorHoverProvider(colorProvider)
    )
  )
  // 提供快速修复（Quick Fix） 类型的代码建议或修复操作
  // 触发方式：当用户将鼠标悬停在有错误/警告的代码上时，VS Code 会显示一个灯泡图标，点击后弹出可执行的修复建议
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      ['scss', 'css', 'vue', 'typescript', 'javascript', 'html', 'jsx', 'tsx'],
      new ColorCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
      }
    )
  )
}

export function deactivate() {}
