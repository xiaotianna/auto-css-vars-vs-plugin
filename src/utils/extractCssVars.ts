interface CssVarInfo {
  name: string;
  value: string;
  isReference: boolean;
  referencedVar?: string;
}

interface ColorGroup {
  colorValue: string;
  variables: CssVarInfo[];
}

export function extractCssVars(content: string): Record<string, ColorGroup> {
  const vars: Record<string, CssVarInfo> = {};
  const colorGroups: Record<string, ColorGroup> = {};
  
  // 第一步：提取所有CSS变量
  const varRegex = /--[^:\s]+:\s*([^;]+)/g;
  let match;
  
  while ((match = varRegex.exec(content)) !== null) {
    const varName = match[0].split(':')[0].trim();
    const value = match[1].trim();
    
    // 检查是否是var()引用
    const varMatch = value.match(/var\(--([^)]+)\)/);
    if (varMatch) {
      vars[varName] = {
        name: varName,
        value: value,
        isReference: true,
        referencedVar: `--${varMatch[1]}`
      };
    } else {
      vars[varName] = {
        name: varName,
        value: value,
        isReference: false
      };
    }
  }
  
  // 第二步：建立颜色映射关系
  for (const [varName, varInfo] of Object.entries(vars)) {
    let actualColorValue = varInfo.value;
    
    // 如果是引用，需要找到被引用的变量的实际颜色值
    if (varInfo.isReference && varInfo.referencedVar) {
      let currentVar = vars[varInfo.referencedVar];
      let depth = 0;
      const maxDepth = 10; // 防止无限循环
      
      while (currentVar && currentVar.isReference && currentVar.referencedVar && depth < maxDepth) {
        currentVar = vars[currentVar.referencedVar];
        depth++;
      }
      
      if (currentVar && !currentVar.isReference) {
        actualColorValue = currentVar.value;
      }
    }
    
    // 标准化颜色值（将#000000和#000视为相同）
    const normalizedColor = normalizeColorValue(actualColorValue);
    
    if (!colorGroups[normalizedColor]) {
      colorGroups[normalizedColor] = {
        colorValue: normalizedColor,
        variables: []
      };
    }
    
    colorGroups[normalizedColor].variables.push(varInfo);
  }
  
  return colorGroups;
}

function normalizeColorValue(color: string): string {
  // 移除空格
  color = color.trim();
  
  // 处理6位十六进制颜色
  const hex6Match = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6Match) {
    const hex = hex6Match[1];
    // 如果所有字符都相同，转换为3位
    if (hex[0] === hex[1] && hex[2] === hex[3] && hex[4] === hex[5]) {
      return `#${hex[0]}${hex[2]}${hex[4]}`;
    }
    return color;
  }
  
  // 处理3位十六进制颜色
  const hex3Match = color.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3Match) {
    const hex = hex3Match[1];
    // 如果所有字符都相同，保持3位格式
    if (hex[0] === hex[1] && hex[1] === hex[2]) {
      return color;
    }
    // 否则转换为6位
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  
  return color;
}