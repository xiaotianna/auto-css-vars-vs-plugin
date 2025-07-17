import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ColorMapping {
  [key: string]: string;
}

interface VarToRefs {
  [varName: string]: string[];
}

export class ColorProvider {
  // 颜色映射
  private colorMapping: ColorMapping = {};
  private varsFilePath: string | null = null;
  private varToRefs: VarToRefs = {};
  private varValueToVarName: { [color: string]: string[] } = {};

  constructor() {
    this.initializeColorMapping();
  }

  // 初始化颜色映射
  private async initializeColorMapping() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    this.varsFilePath = path.join(workspaceFolder.uri.fsPath, 'src', 'assets', 'style', '_vars.scss');
    
    if (fs.existsSync(this.varsFilePath)) {
      await this.parseColorMapping(this.varsFilePath);
    }
  }

  private async parseColorMapping(varsFilePath: string): Promise<void> {
    const content = fs.readFileSync(varsFilePath, 'utf8');
    this.colorMapping = {};
    this.varToRefs = {};
    this.varValueToVarName = {};
    
    // 匹配CSS变量定义的正则表达式
    const varRegex = /--([\w-]+):\s*([^;]+);/g;
    
    let match;
    const varToValue: { [varName: string]: string } = {};
    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[1];
      const value = match[2].trim();
      varToValue[`--${varName}`] = value;
      // 记录直接颜色值到变量名
      const normalized = this.normalizeColor(value);
      if (normalized) {
        if (!this.varValueToVarName[normalized]) {
          this.varValueToVarName[normalized] = [];
        }
        this.varValueToVarName[normalized].push(`--${varName}`);
        this.colorMapping[normalized] = `var(--${varName})`;
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
    if (this.varsFilePath && fs.existsSync(this.varsFilePath)) {
      await this.parseColorMapping(this.varsFilePath);
    }
  }
} 