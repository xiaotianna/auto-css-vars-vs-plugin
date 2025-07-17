import * as vscode from 'vscode';
import { ColorProvider } from './ColorProvider';

export class ColorHoverProvider implements vscode.HoverProvider {
  private colorProvider: ColorProvider;

  constructor(colorProvider: ColorProvider) {
    this.colorProvider = colorProvider;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position, /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/);
    
    if (!range) {
      return null;
    }

    const colorValue = document.getText(range);
    const cssVar = this.colorProvider.getCssVarForColor(colorValue);

    if (cssVar) {
      const contents = new vscode.MarkdownString();
      contents.appendMarkdown(`**颜色值**: \`${colorValue}\`\n\n`);
      contents.appendMarkdown(`**对应的CSS变量**: \`${cssVar}\`\n\n`);
      contents.appendMarkdown('点击 `Ctrl+Shift+R` 或使用命令面板替换为CSS变量');
      
      return new vscode.Hover(contents, range);
    }

    return null;
  }
} 