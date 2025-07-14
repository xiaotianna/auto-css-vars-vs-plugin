import * as vscode from 'vscode'
import { readCssVars } from '../utils/readCssVars'
import * as path from 'path'
import * as fs from 'fs'
import { loadConfig } from '../utils/readFile'

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

    // 展示配置中的 cssFiles
    webviewView.webview.html = `
  <h4>CSS 文件列表：</h4>
  <ul>
    ${config.cssFiles.map((file) => `<li>${file}</li>`).join('')}
  </ul>
`
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
    return `
    <p>当前工作区路径: ${this._extensionUri.fsPath}</p>
    <p>配置文件路径: ${this._configPath}</p>
    <h4>CSS 文件列表：</h4>
    <ul>
      ${cssFiles.map((file) => `<li>${file}</li>`).join('')}
    </ul>
  `
  }
}
