import * as vscode from 'vscode';
import { ColorProvider } from '../provider/ColorProvider';
import { normalizeColor } from './normalizeColor';

export async function replaceColorsInDocument(colorProvider: ColorProvider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('没有活动的编辑器');
    return;
  }

  const colorMapping = colorProvider.getColorMapping();
  
  if (Object.keys(colorMapping).length === 0) {
    vscode.window.showInformationMessage('没有找到颜色变量定义，请确保文件存在');
    return;
  }

  // 执行替换
  await performColorReplacement(editor, colorMapping);
}

async function performColorReplacement(editor: vscode.TextEditor, colorMapping: any) {
  const document = editor.document;
  const text = document.getText();
  let modifiedText = text;
  let hasChanges = false;

  // 匹配颜色值的正则表达式
  const colorRegex = /(color|background|border|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;
  
  modifiedText = modifiedText.replace(colorRegex, (match: string, property: string, colorValue: string) => {
    const normalizedColor = normalizeColor(colorValue);
    const cssVar = colorMapping[normalizedColor];
    
    if (cssVar) {
      hasChanges = true;
      return `${property}: ${cssVar}`;
    }
    
    return match;
  });

  if (hasChanges) {
    // 创建编辑操作
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(text.length)
    );
    
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, modifiedText);
    
    // 应用编辑
    const success = await vscode.workspace.applyEdit(edit);
    
    if (success) {
      vscode.window.showInformationMessage('颜色值已成功替换为CSS变量');
    } else {
      vscode.window.showErrorMessage('替换失败');
    }
  } else {
    vscode.window.showInformationMessage('没有找到需要替换的颜色值');
  }
}