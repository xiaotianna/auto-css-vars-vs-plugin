import * as vscode from 'vscode';
import { ColorProvider } from './ColorProvider';

export class CssVarCompletionProvider implements vscode.CompletionItemProvider {
  private colorProvider: ColorProvider;

  constructor(colorProvider: ColorProvider) {
    this.colorProvider = colorProvider;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
    // 获取当前行的文本
    const lineText = document.lineAt(position).text;
    const linePrefix = lineText.substring(0, position.character);
    
    console.log('自动补全触发，当前行前缀:', JSON.stringify(linePrefix));
    console.log('当前位置:', position.character);
    
    // 简化匹配逻辑：包含 - 或在CSS属性值位置就触发
    const shouldTrigger = 
      linePrefix.includes('-') || // 包含减号
      linePrefix.includes('var(') || // 在var()中
      /:\s*$/.test(linePrefix) || // 在CSS属性值位置
      context.triggerKind === vscode.CompletionTriggerKind.Invoke; // 手动触发
    
    if (!shouldTrigger) {
      console.log('未匹配触发条件');
      return [];
    }
    
    console.log('匹配触发条件，开始获取CSS变量');

    // 刷新颜色映射以获取最新的CSS变量
    await this.colorProvider.refreshColorMapping();

    const completionItems: vscode.CompletionItem[] = [];
    const allVars = this.colorProvider.getAllVars();

    console.log('获取到的CSS变量数量:', Object.keys(allVars).length);
    console.log('CSS变量:', allVars);

    // 从所有CSS变量中创建补全项
    Object.entries(allVars).forEach(([varName, value]) => {
      const completionItem = new vscode.CompletionItem(
        varName,
        vscode.CompletionItemKind.Variable
      );
      
      // 设置插入文本 - 简化逻辑
      if (linePrefix.includes('var(')) {
        // 如果在 var( 中，只插入变量名
        completionItem.insertText = varName;
      } else {
        // 默认插入完整的 var() 格式
        completionItem.insertText = `var(${varName})`;
      }
      
      // 设置详细信息
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
      
      // 设置排序优先级
      completionItem.sortText = `0${varName}`;
      
      // 设置过滤文本（用于搜索匹配）
      completionItem.filterText = varName;
      
      completionItems.push(completionItem);
    });

    // 如果没有找到变量，提供一个提示
    if (completionItems.length === 0) {
      const noVarsItem = new vscode.CompletionItem(
        '未找到CSS变量',
        vscode.CompletionItemKind.Text
      );
      noVarsItem.detail = '请检查配置文件: src/assets/style/_vars.scss';
      noVarsItem.documentation = new vscode.MarkdownString(
        '请确保在 `src/assets/style/_vars.scss` 文件中定义了CSS变量'
      );
      noVarsItem.insertText = '';
      completionItems.push(noVarsItem);
    }

    return completionItems;
  }

  resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
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