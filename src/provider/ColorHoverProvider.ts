import * as vscode from 'vscode'
import { ColorProvider } from './ColorProvider'

export class ColorHoverProvider implements vscode.HoverProvider {
  private colorProvider: ColorProvider

  constructor(colorProvider: ColorProvider) {
    this.colorProvider = colorProvider
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(
      position,
      /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/
    )

    if (!range) {
      return null
    }

    const colorValue = document.getText(range)
    const cssVar = this.colorProvider.getCssVarForColor(colorValue)
    
    if (cssVar && cssVar.length > 0) {
      const contents = new vscode.MarkdownString()
      contents.appendMarkdown(`**颜色值**: \`${colorValue}\`\n\n`)
      contents.appendMarkdown(`**对应的CSS变量**: \`${cssVar}\`\n\n`)
      const replaceCommandUri = vscode.Uri.parse(
        'command:auto-css-vars.replaceColors'
      )
      const selectCommandUri = vscode.Uri.parse(
        'command:auto-css-vars.pickAndReplaceColorVar'
      )
      contents.appendMarkdown(`[🚀点击此处替换为CSS变量](${replaceCommandUri})\b\b[📦选择其他CSS变量](${selectCommandUri})\n\n`)
      // command URIs如果想在 Markdown 内容中生效, 你必须设置`isTrusted`，来创建可信的Markdown 字符
      contents.isTrusted = true
      return new vscode.Hover(contents, range)
    } else {
      const contents = new vscode.MarkdownString()
      contents.appendMarkdown(`**当前选择的颜色不在配置文件中**\n\n`)
      return new vscode.Hover(contents, range)
    }

    return null
  }
}
