import * as vscode from 'vscode';
import { ColorProvider } from './ColorProvider';

export class SimpleCssVarCompletionProvider implements vscode.CompletionItemProvider {
  private colorProvider: ColorProvider;

  constructor(colorProvider: ColorProvider) {
    this.colorProvider = colorProvider;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    console.log('SimpleCssVarCompletionProvider 被触发');
    
    // 刷新颜色映射以获取最新的CSS变量
    await this.colorProvider.refreshColorMapping();
    
    const allVars = this.colorProvider.getAllVars();
    console.log('获取到的CSS变量:', Object.keys(allVars));
    
    const completionItems: vscode.CompletionItem[] = [];
    
    // 为每个CSS变量创建补全项
    Object.entries(allVars).forEach(([varName, value]) => {
      const completionItem = new vscode.CompletionItem(
        varName,
        vscode.CompletionItemKind.Variable
      );
      
      completionItem.insertText = `var(${varName})`;
      completionItem.detail = `CSS变量: ${value}`;
      
      // 创建带颜色块的文档
      const documentation = new vscode.MarkdownString();
      documentation.appendMarkdown(`**变量**: \`${varName}\`\n\n`);
      documentation.appendMarkdown(`**值**: ${value}\n\n`);
      
      // 尝试提取颜色值并显示颜色块
      const colorValue = this.extractColorValue(value, allVars);
      if (colorValue) {
        documentation.appendMarkdown(`**颜色预览**: `);
        documentation.appendMarkdown(`<div style="display: inline-block; width: 20px; height: 20px; background-color: ${colorValue}; border: 2px solid #ddd; border-radius: 3px; margin: 0 8px; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>`);
        documentation.appendMarkdown(`\`${colorValue}\`\n\n`);
        
        // 如果原始值不是直接的颜色值，显示解析路径
        if (value.includes('var(') && colorValue !== value.toLowerCase()) {
          documentation.appendMarkdown(`**解析路径**: \`${value}\` → \`${colorValue}\`\n\n`);
        }
      }
      
      completionItem.documentation = documentation;
      completionItem.sortText = `0${varName}`;
      completionItem.filterText = varName;
      
      completionItems.push(completionItem);
    });
    
    console.log('返回补全项数量:', completionItems.length);
    return completionItems;
  }

  // 提取颜色值的方法
  private extractColorValue(value: string, allVars: { [varName: string]: string }, visited: Set<string> = new Set()): string | null {
    // 移除空格
    value = value.trim();
    
    // 防止无限递归
    if (visited.has(value)) {
      return null;
    }
    visited.add(value);
    
    // 匹配十六进制颜色
    const hexMatch = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hexMatch) {
      return value.toLowerCase();
    }
    
    // 匹配rgb/rgba颜色
    const rgbMatch = value.match(/^rgba?\([^)]+\)$/i);
    if (rgbMatch) {
      return value.toLowerCase();
    }
    
    // 匹配hsl/hsla颜色
    const hslMatch = value.match(/^hsla?\([^)]+\)$/i);
    if (hslMatch) {
      return value.toLowerCase();
    }
    
    // 匹配颜色关键字
    const colorKeywords = [
      'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey',
      'black', 'white', 'transparent', 'currentcolor', 'inherit', 'initial', 'unset',
      'aqua', 'cyan', 'fuchsia', 'lime', 'maroon', 'navy', 'olive', 'silver', 'teal'
    ];
    if (colorKeywords.includes(value.toLowerCase())) {
      return value.toLowerCase();
    }
    
    // 尝试解析var()引用，递归查找实际颜色值
    const varMatch = value.match(/var\(--([^)]+)\)/);
    if (varMatch) {
      const referencedVar = `--${varMatch[1]}`;
      const referencedValue = allVars[referencedVar];
      
      if (referencedValue) {
        // 递归查找引用的变量值
        return this.extractColorValue(referencedValue, allVars, visited);
      }
    }
    
    return null;
  }
} 