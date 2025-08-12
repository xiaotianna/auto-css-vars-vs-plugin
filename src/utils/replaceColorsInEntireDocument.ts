import * as vscode from 'vscode'
import { ColorProvider } from '../provider/ColorProvider'

/**
 * 一键替换整个文档中的颜色值为CSS变量
 * 只替换基色，不递归替换引用变量
 * @param colorProvider 颜色提供者实例
 */
export async function replaceColorsInEntireDocument(colorProvider: ColorProvider) {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showInformationMessage('没有活动的编辑器')
    return
  }

  const document = editor.document
  const text = document.getText()
  
  // 颜色正则表达式，匹配十六进制、rgb、rgba、hsl、hsla颜色值
  const colorRegex = /(#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))/g
  
  // 存储所有匹配的颜色位置和值
  const colorMatches: { range: vscode.Range; colorValue: string }[] = []
  
  let match
  while ((match = colorRegex.exec(text)) !== null) {
    const startPos = document.positionAt(match.index)
    const endPos = document.positionAt(match.index + match[0].length)
    const range = new vscode.Range(startPos, endPos)
    const colorValue = match[0]
    
    // 检查这个范围是否在注释中，如果在注释中则跳过
    if (isInComment(document, range)) {
      continue
    }
    
    colorMatches.push({
      range,
      colorValue
    })
  }
  
  if (colorMatches.length === 0) {
    vscode.window.showInformationMessage('在文档中未找到颜色值')
    return
  }
  
  // 询问用户是否确认替换
  const confirm = await vscode.window.showWarningMessage(
    `找到 ${colorMatches.length} 个颜色值，是否替换为对应的CSS变量？`,
    { modal: true },
    '替换',
    '取消'
  )
  
  if (confirm !== '替换') {
    return
  }
  
  // 执行替换操作
  await editor.edit(editBuilder => {
    // 从后往前替换，避免位置偏移
    for (let i = colorMatches.length - 1; i >= 0; i--) {
      const { range, colorValue } = colorMatches[i]
      const cssVars = colorProvider.getCssVarForColor(colorValue)
      
      // 如果找到对应的CSS变量，则替换
      if (cssVars.length > 0) {
        // 如果有多个变量，使用第一个
        const cssVar = cssVars[0]
        editBuilder.replace(range, `var(${cssVar})`)
      }
    }
  })
  
  vscode.window.showInformationMessage(`已完成颜色值替换，共替换 ${colorMatches.length} 个颜色值`)
}

/**
 * 检查指定范围是否在注释中
 * @param document 文档
 * @param range 范围
 * @returns 是否在注释中
 */
function isInComment(document: vscode.TextDocument, range: vscode.Range): boolean {
  const line = document.lineAt(range.start.line)
  const lineText = line.text
  const commentStart = lineText.indexOf('/*')
  const commentEnd = lineText.indexOf('*/')
  const singleLineCommentStart = lineText.indexOf('//')
  
  const rangeStart = range.start.character
  
  // 检查多行注释
  if (commentStart !== -1 && (commentEnd === -1 || commentEnd < rangeStart)) {
    return true
  }
  
  // 检查单行注释
  if (singleLineCommentStart !== -1 && singleLineCommentStart < rangeStart) {
    return true
  }
  
  return false
}