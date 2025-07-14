import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { loadConfig } from '../utils/readFile'
import { writeCssVar } from '../utils/writeCssVars'
import { extractCssVars } from '../utils/extractCssVars'

export class ColorVarsWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = 'color-vars-plugin-view'
  private _webview: vscode.WebviewView | null = null
  private _configPath: string | null = null
  private _fileWatcher: fs.FSWatcher | null = null

  constructor(private readonly _extensionUri: vscode.Uri) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true
    }

    // 打开所有工作空间
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
      webviewView.webview.html = '请打开一个工作区'
      return
    }
    // 判断当前文件属于哪个工作区
    const activeEditor = vscode.window.activeTextEditor
    if (!activeEditor) {
      webviewView.webview.html = '请打开一个文件'
      return
    }

    const folder = vscode.workspace.getWorkspaceFolder(
      activeEditor.document.uri
    )
    if (!folder) {
      webviewView.webview.html = '当前文件不属于任何工作区'
      return
    }

    const rootPath = folder.uri.fsPath

    // 读取 .autocolorvars.js，尝试多个后缀的配置文件
    const configBasename = '.autocolorvars'
    const possibleExtensions = ['.cjs', '.js', ''] // 优先 .cjs > .js > 无后缀
    let configPath: string | null = null
    for (const ext of possibleExtensions) {
      const tryPath = path.join(rootPath, configBasename + ext)
      if (fs.existsSync(tryPath)) {
        configPath = tryPath
        break
      }
    }

    // 保存 webview 引用
    this._webview = webviewView
    if (!configPath) {
      webviewView.webview.html = `⚠️ 配置文件未找到：<br>在路径 ${rootPath} 下未找到 .autocolorvars(.cjs|.js) 文件`
      return
    } else {
      // 找到 configPath 后，设置监听
      this._configPath = configPath
      // 如果已有监听器，先关闭
      if (this._fileWatcher) {
        this._fileWatcher.close()
      }
      // 开始监听文件变化
      this._fileWatcher = fs.watch(configPath, (eventType) => {
        if (eventType === 'change') {
          this.reloadConfigAndRefreshWebview()
        }
      })
    }

    let config: { cssFiles: string[] } = { cssFiles: [] }
    try {
      config = loadConfig(configPath)
    } catch (e: any) {
      webviewView.webview.html = `⚠️ 配置文件加载失败：<br>${e.message}`
      return
    }

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'updateCssVar': {
          const { varName, newValue } = message
          console.log(`更新变量 ${varName} 为 ${newValue}`)
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
          if (!workspaceFolder) return

          const cssFilePath = path.join(
            workspaceFolder.uri.fsPath,
            'styles.css'
          ) // 示例路径，请根据实际选择
          writeCssVar(cssFilePath, varName, newValue)
          vscode.window.showInformationMessage(
            `变量 ${varName} 已更新为 ${newValue}`
          )
          break
        }
      }
    })

    // 展示配置中的 cssFiles
    webviewView.webview.html = this.generateHtml(config.cssFiles)
  }

  private async reloadConfigAndRefreshWebview() {
    const webview = this._webview
    if (!webview || !this._configPath) return

    try {
      const config = loadConfig(this._configPath)
      const html = this.generateHtml(config.cssFiles)
      webview.webview.html = html
    } catch (e: any) {
      webview.webview.html = `⚠️ 配置文件加载失败：<br>${e.message}`
    }
  }

  // 抽离 HTML 渲染逻辑方便复用
  private generateHtml(cssFiles: string[]) {
  const allCssVars = cssFiles.map((filePath) => {
    try {
      const fullPath = path.join(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        filePath
      );
      const content = fs.readFileSync(fullPath, 'utf8');
      return extractCssVars(content);
    } catch (e) {
      console.error(`读取 ${filePath} 失败`, e);
      return {};
    }
  });

  const flatVars = Object.entries(Object.assign({}, ...allCssVars));

  const varsHtml = flatVars
    .map(([key, value]) => {
      return `
      <div class="var-item">
        <label>${key}</label>
        <div class="input-group">
          <input type="color" class="color-picker" data-var-name="${key}" value="${value}" />
          <input type="text" class="color-input" data-var-name="${key}" value="${value}" placeholder="请填入颜色" />
        </div>
      </div>
      `;
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #282c34;
        color: #abb2bf;
        padding: 0 24px 24px;
      }

      .var-item {
        margin-bottom: 16px;
      }

      .var-item label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
      }

      .input-group {
        display: flex;
        align-items: center;
      }

      .color-picker,
      .color-input {
        height: 32px;
        border: 1px solid #4b5563;
        border-radius: 4px;
        padding: 0 8px;
        margin-right: 8px;
        transition: border-color 0.2s;
      }

      .color-picker {
        flex: 0 0 auto;
        width: 72px;
      }

      .color-input {
        flex: 1;
      }

      .color-picker:focus,
      .color-input:focus {
        outline: none;
        border-color: #61dafb;
      }
    </style>
  </head>
  <body>
    <h3>CSS 变量颜色预览</h3>
    ${varsHtml}
    <script>
      const colorInputs = document.querySelectorAll('.color-picker');
      const textInputs = document.querySelectorAll('.color-input');

      // 颜色选择器改变时
      colorInputs.forEach(input => {
        input.addEventListener('change', () => {
          const varName = input.getAttribute('data-var-name');
          const newValue = input.value;
          // 同步更新文本框值
          const textInput = document.querySelector('.color-input[data-var-name="' + varName + '"]');
          if (textInput) {
            textInput.value = newValue;
          }
          vscode.postMessage({
            command: 'updateCssVar',
            varName,
            newValue
          });
        });
      });

      // 文本框输入时
      textInputs.forEach(input => {
        input.addEventListener('input', () => {
          const varName = input.getAttribute('data-var-name');
          const newValue = input.value;
          // 同步更新颜色选择器值
          const colorInput = document.querySelector('.color-picker[data-var-name="' + varName + '"]');
          if (colorInput) {
            colorInput.value = newValue;
          }
          vscode.postMessage({
            command: 'updateCssVar',
            varName,
            newValue
          });
        });
      });
    </script>
  </body>
  </html>
  `;
}
}
