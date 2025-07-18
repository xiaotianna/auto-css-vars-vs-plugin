export function normalizeColor(color: string): string {
  // 处理十六进制颜色
  if (color.startsWith('#')) {
    // 将3位十六进制转换为6位
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color.toLowerCase();
  }
  
  // 处理rgb/rgba颜色
  if (color.startsWith('rgb')) {
    return color.toLowerCase().replace(/\s+/g, '');
  }
  
  return color.toLowerCase();
}