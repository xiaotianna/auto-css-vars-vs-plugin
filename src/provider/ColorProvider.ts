import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from '../utils/readFile';
import { extractCssVars } from '../utils/extractCssVars';

interface ColorMapping {
  [key: string]: string;
}

interface VarToRefs {
  [varName: string]: string[];
}

export class ColorProvider {
  // 颜色映射
  private colorMapping: ColorMapping = {};
  private configPath: string | null = null;
  private varToRefs: VarToRefs = {};
  private varValueToVarName: { [color: string]: string[] } = {};
  private allVars: { [varName: string]: string } = {};

  constructor() {
    this.initializeColorMapping();
  }

  // 初始化颜色映射
  private async initializeColorMapping() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    // 寻找配置文件
    this.configPath = this.findConfigFile(workspaceFolder.uri.fsPath);
    
    if (this.configPath) {
      await this.parseColorMappingFromConfig();
    }
  }

  // 寻找配置文件
  private findConfigFile(rootPath: string): string | null {
    const configBasename = '.autocolorvars';
    const possibleExtensions = ['.cjs', '.js', '']; // 优先 .cjs > .js > 无后缀
    
    console.log('正在搜索配置文件，根路径:', rootPath);
    
    for (const ext of possibleExtensions) {
      const tryPath = path.join(rootPath, configBasename + ext);
      console.log('尝试路径:', tryPath);
      if (fs.existsSync(tryPath)) {
        console.log('找到配置文件:', tryPath);
        return tryPath;
      }
    }
    console.log('未找到配置文件');
    return null;
  }

  private async parseColorMappingFromConfig(): Promise<void> {
    if (!this.configPath) {
      return;
    }

    this.colorMapping = {};
    this.varToRefs = {};
    this.varValueToVarName = {};
    this.allVars = {};

    try {
      // 读取配置文件
      console.log('正在读取配置文件:', this.configPath);
      const config = loadConfig(this.configPath);
      console.log('配置文件内容:', config);
      
      if (!config.cssFiles || !Array.isArray(config.cssFiles)) {
        console.error('配置文件格式错误：cssFiles 应该是一个数组');
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return;
      }

      const rootPath = workspaceFolder.uri.fsPath;
      console.log('工作区根路径:', rootPath);

      // 遍历所有CSS文件
      for (const cssFile of config.cssFiles) {
        const fullPath = path.join(rootPath, cssFile);
        console.log('处理CSS文件:', fullPath);
        if (fs.existsSync(fullPath)) {
          await this.parseColorMappingFromFile(fullPath);
          console.log(`成功解析CSS文件: ${fullPath}`);
        } else {
          console.warn(`CSS文件不存在: ${fullPath}`);
        }
      }
      console.log('解析完成，共找到变量:', Object.keys(this.allVars).length);
    } catch (error) {
      console.error('解析配置文件失败:', error);
    }
  }

  private async parseColorMappingFromFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 匹配CSS变量定义的正则表达式
    const varRegex = /--([\w-]+):\s*([^;]+);/g;
    
    let match;
    const varToValue: { [varName: string]: string } = {};
    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[1];
      const value = match[2].trim();
      const fullVarName = `--${varName}`;
      varToValue[fullVarName] = value;
      this.allVars[fullVarName] = value;
      
      // 记录直接颜色值到变量名
      const normalized = this.normalizeColor(value);
      if (normalized) {
        if (!this.varValueToVarName[normalized]) {
          this.varValueToVarName[normalized] = [];
        }
        this.varValueToVarName[normalized].push(fullVarName);
        this.colorMapping[normalized] = `var(${fullVarName})`;
      }
    }
    // 解析引用关系
    for (const [varName, value] of Object.entries(varToValue)) {
      const refVarMatch = value.match(/var\((--[\w-]+)\)/);
      if (refVarMatch) {
        const refVar = refVarMatch[1];
        if (!this.varToRefs[refVar]) {
          this.varToRefs[refVar] = [];
        }
        this.varToRefs[refVar].push(varName);
      }
    }
  }

  private normalizeColor(color: string): string {
    if (!color) return '';
    // 处理十六进制颜色
    if (color.startsWith('#')) {
      if (color.length === 4) {
        color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color.toLowerCase();
    }
    // 处理rgb/rgba颜色
    if (color.startsWith('rgb')) {
      return color.toLowerCase().replace(/\s+/g, '');
    }
    // 处理直接fff这种
    if (/^[0-9a-fA-F]{3}$/.test(color)) {
      return '#' + color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    return color.toLowerCase();
  }

  public getColorMapping(): ColorMapping {
    return this.colorMapping;
  }

  public getCssVarForColor(color: string): string[] {
    const normalizedColor = this.normalizeColor(color);
    return this.varValueToVarName[normalizedColor] || [];
  }

  public getRefsForVar(varName: string): string[] {
    return this.varToRefs[varName] || [];
  }

  public async refreshColorMapping() {
    // 获取当前活动编辑器所在的工作区
    const activeEditor = vscode.window.activeTextEditor;
    let workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (activeEditor) {
      const currentWorkspace = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
      if (currentWorkspace) {
        workspaceFolder = currentWorkspace;
      }
    }
    
    if (!workspaceFolder) {
      console.log('没有找到工作区');
      return;
    }
    
    // 如果配置文件路径不存在或不是当前工作区的，重新寻找
    if (!this.configPath || !this.configPath.startsWith(workspaceFolder.uri.fsPath)) {
      this.configPath = this.findConfigFile(workspaceFolder.uri.fsPath);
    }
    
    if (this.configPath && fs.existsSync(this.configPath)) {
      await this.parseColorMappingFromConfig();
    } else {
      console.log('未找到或无法读取配置文件');
    }
  }

  public getAllVars(): { [varName: string]: string } {
    return this.allVars;
  }
} 