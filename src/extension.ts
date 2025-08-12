import * as vscode from 'vscode'
import { ColorVarsWebviewViewProvider } from './provider/ColorVarsWebviewViewProvider'
import { ColorProvider } from './provider/ColorProvider'
import { ColorHoverProvider } from './provider/ColorHoverProvider'
import { replaceColorsInDocument } from './utils/replaceColorsInDocument'
import { ColorCodeActionProvider } from './provider/ColorCodeActionProvider'
import { pickAndReplaceColorVar } from './utils/pickAndReplaceColorVar'
import { CssVarCompletionProvider } from './provider/CssVarCompletionProvider'
import { replaceColorsInEntireDocument } from './utils/replaceColorsInEntireDocument'

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
  // 命令：刷新CSS变量视图
  context.subscriptions.push(
    vscode.commands.registerCommand('auto-css-vars.refreshView', () => {
      colorVarsWebviewViewProvider.refresh()
      vscode.window.showInformationMessage('CSS变量视图已刷新')
    })
  )
  // 命令：一键替换文档中的颜色值
  context.subscriptions.push(
    vscode.commands.registerCommand('auto-css-vars.replaceColorsInDocument', () => {
      replaceColorsInEntireDocument(colorProvider)
    })
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
  // 注册CSS变量自动补全提供器 - 带触发字符
  // 当用户输入 '-' 时提供CSS变量补全建议
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      ['scss', 'css', 'vue', 'typescript', 'javascript', 'html', 'jsx', 'tsx'],
      new CssVarCompletionProvider(colorProvider),
      '-' // 触发字符
    )
  )
  
  // 注册简化版CSS变量自动补全提供器 - 无触发字符（通过Ctrl+Space触发）
  // context.subscriptions.push(
  //   vscode.languages.registerCompletionItemProvider(
  //     ['scss', 'css', 'vue', 'typescript', 'javascript', 'html', 'jsx', 'tsx'],
  //     new SimpleCssVarCompletionProvider(colorProvider)
  //   )
  // )
}

export function deactivate() {}
