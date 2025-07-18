import * as vscode from 'vscode'
import { ColorProvider } from '../provider/ColorProvider'

export async function replaceColorsInDocument(colorProvider: ColorProvider) {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showInformationMessage('没有活动的编辑器')
    return
  }
  const document = editor.document
  const selection = editor.selection
  let selectedText = document.getText(selection).trim()
  if (!selectedText) {
    vscode.window.showInformationMessage('请先选中一个颜色值')
    return
  }
  // 支持fff、#fff、#ffffff、rgb/rgba/等
  if (/^[0-9a-fA-F]{3}$/.test(selectedText)) {
    selectedText =
      '#' +
      selectedText[0] +
      selectedText[0] +
      selectedText[1] +
      selectedText[1] +
      selectedText[2] +
      selectedText[2]
  }
  if (
    !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3,8})$/.test(selectedText) &&
    !/^rgb(a)?\([^)]+\)$/i.test(selectedText) &&
    !/^hsl(a)?\([^)]+\)$/i.test(selectedText)
  ) {
    vscode.window.showInformationMessage('选中的内容不是有效的颜色值')
    return
  }
  const position = selection.active
  const range = document.getWordRangeAtPosition(
    position,
    /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/
  )

  if (!range) {
    return null
  }
  const colorValue = document.getText(range)
  const cssVar = colorProvider.getCssVarForColor(colorValue)
  vscode.window.showInformationMessage(
    `${colorValue} 对应的 CSS 变量是：${cssVar}`
  )

  editor.edit((editBuilder) => {
    const newSelection = new vscode.Selection(
      selection.start.translate(0, -1),
      selection.end
    )
    editBuilder.replace(newSelection, `var(${cssVar})`)
  })
}
