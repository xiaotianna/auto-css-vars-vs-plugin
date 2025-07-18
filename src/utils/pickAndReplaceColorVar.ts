import * as vscode from 'vscode'
import { ColorProvider } from '../provider/ColorProvider'

// 选中颜色弹窗选择变量并替换
export async function pickAndReplaceColorVar(colorProvider: ColorProvider) {
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
  // 获取所有直接变量
  const varNames = colorProvider.getCssVarForColor(selectedText)
  if (!varNames || varNames.length === 0) {
    vscode.window.showInformationMessage('未找到匹配的CSS变量')
    return
  }
  // 获取所有引用该变量的扩展变量
  let allOptions: { label: string; description: string }[] = []
  for (const varName of varNames) {
    allOptions.push({ label: varName, description: '直接变量' })
    const refs = colorProvider.getRefsForVar(varName)
    for (const ref of refs) {
      allOptions.push({ label: ref, description: `扩展自 ${varName}` })
    }
  }
  // 去重
  allOptions = allOptions.filter(
    (item, idx, arr) => arr.findIndex((i) => i.label === item.label) === idx
  )
  if (allOptions.length === 0) {
    vscode.window.showInformationMessage('未找到可用的CSS变量')
    return
  }
  // 弹出选择
  const picked = await vscode.window.showQuickPick(allOptions, {
    placeHolder: '选择要替换的CSS变量'
  })
  if (!picked) return
  // 替换选中内容
  editor.edit((editBuilder) => {
    const newSelection = new vscode.Selection(
      selection.start.translate(0, -1),
      selection.end
    )
    editBuilder.replace(newSelection, `var(${picked.label})`)
  })
  vscode.window.showInformationMessage(`已用${picked.label}替换颜色`)
}
