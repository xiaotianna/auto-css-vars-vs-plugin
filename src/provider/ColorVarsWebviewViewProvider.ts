import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { loadConfig } from '../utils/readFile'
import { extractCssVars } from '../utils/extractCssVars'

export class ColorVarsWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = 'color-vars-plugin-view'
  private _webview: vscode.WebviewView | null = null
  private _configPath: string | null = null
  private _fileWatcher: fs.FSWatcher | null = null
  private _watchedFiles: string[] = []

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
    this.watchCssFiles()

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'copyToClipboard': {
          const { varName } = message
          if (varName) {
            vscode.window.showInformationMessage(`已复制变量名：${varName}`)
          }
          break
        }
      }
    })

    // 展示配置中的 cssFiles
    webviewView.webview.html = this.generateHtml(config.cssFiles)
  }

  private watchCssFiles() {
    // 清除已有监听
    this.disposeWatchers()

    if (!this._configPath) return

    try {
      const config = loadConfig(this._configPath)
      const folder = vscode.workspace.workspaceFolders?.[0]

      if (!folder) return

      const rootPath = folder.uri.fsPath

      // 清除旧的监听器
      if (this._fileWatcher) {
        this._fileWatcher.close()
      }

      // 监听所有配置的 cssFiles 路径
      const filePaths = config.cssFiles.map((file: string) =>
        path.join(rootPath, file)
      )

      // 使用 fs.watchFile 来监听多个文件
      filePaths.forEach((filePath: string) => {
        fs.watchFile(filePath, { interval: 100 }, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            console.log(`文件 ${filePath} 发生修改，刷新 Webview`)
            this.reloadConfigAndRefreshWebview()
          }
        })
      })

      // 记录当前监听的文件路径列表，便于后续清理
      this._watchedFiles = filePaths
    } catch (e) {
      console.error('监听 CSS 文件失败:', e)
    }
  }

  private disposeWatchers() {
    if (this._fileWatcher) {
      this._fileWatcher.close()
      this._fileWatcher = null
    }

    if (this._watchedFiles) {
      this._watchedFiles.forEach((filePath) => {
        fs.unwatchFile(filePath)
      })
      this._watchedFiles = []
    }
  }

  dispose() {
    this.disposeWatchers()
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

  public getConfig(): { cssFiles: string[] } | null {
    if (!this._configPath) return null
    return loadConfig(this._configPath)
  }

  // 抽离 HTML 渲染逻辑方便复用
  private generateHtml(cssFiles: string[]) {
    // 收集所有文件的颜色组
    const allColorGroups: Record<
      string,
      {
        colorValue: string
        variables: Array<{
          name: string
          value: string
          isReference: boolean
          filePath: string
        }>
      }
    > = {}

    cssFiles.forEach((filePath) => {
      try {
        const fullPath = path.join(
          vscode.workspace.workspaceFolders![0].uri.fsPath,
          filePath
        )
        const content = fs.readFileSync(fullPath, 'utf8')
        const colorGroups = extractCssVars(content)

        // 将每个文件的颜色组合并到全局颜色组中
        Object.entries(colorGroups).forEach(([colorValue, group]) => {
          if (!allColorGroups[colorValue]) {
            allColorGroups[colorValue] = {
              colorValue: colorValue,
              variables: []
            }
          }

          // 为每个变量添加文件路径信息
          group.variables.forEach((variable) => {
            allColorGroups[colorValue].variables.push({
              ...variable,
              filePath: filePath
            })
          })
        })
      } catch (e) {
        console.error(`读取 ${filePath} 失败`, e)
      }
    })

    function convertColorToSixDigits(color: string): string {
      if (color.length === 4 && color.startsWith('#')) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      }
      return color
    }

    // 生成按颜色分组的HTML
    const colorGroupsHtml = Object.entries(allColorGroups)
      .map(([_colorValue, group]) => {
        const colorValue = convertColorToSixDigits(group.colorValue)
        const variablesHtml = group.variables
          .map((variable) => {
            const referenceIndicator = variable.isReference ? ' (引用)' : ''
            return `
            <div class="var-item">
              <label class="var-label" data-var-name="${
                variable.name
              }" title="点击复制变量">${variable.name}
              <span>${referenceIndicator}</span>
              <svg style="margin-left: auto;" fill="#abb2bf" t="1752546282125" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4435" width="15" height="15"><path d="M880 247.008l-162.016-166.016Q700.992 64 677.984 64h-316.992q-26.016 0-46.016 18.016-16.992 15.008-23.008 36.992H231.968q-43.008 0-73.504 31.008t-30.496 76v627.008q0 44 30.496 75.488T231.968 960h508q43.008 0 73.504-31.488t30.496-75.488v-63.008q23.008-6.016 37.504-25.504t14.496-44.512V287.008q0-24-16-40z m-168-160.992l-3.008-3.008z m98.016 177.984L744 196z m-126.016-116.992l108 110.016h-108V147.008zM676.992 128zM204.992 948q4 0.992 4.992 2.016-2.016-0.992-4.992-2.016z m27.008 4q-6.016 0-12-0.992 4.992 0.992 12 0.992z m543.008-99.008q0 15.008-10.016 25.504t-24.992 10.496H232q-14.016 0-24.512-10.496t-10.496-25.504V225.984q0-15.008 10.496-25.504t24.512-10.496h58.016v531.008q0 30.016 20.992 51.008t50.016 20.992H775.04v60z m52-132.992q0 2.016-2.016 2.016h-464q-2.016 0-2.016-2.016V136.992q0-2.016 2.016-2.016h251.008v156.992q0 15.008 10.016 24.992t24 10.016h180.992v392.992z m9.984 64q4-0.992 8.992-2.016-4.992 0.992-8.992 2.016z m-244-168.992h-107.008q-15.008 0-24.992 10.496t-10.016 24.992 10.016 24.992 24.992 10.496h107.008q14.016 0 24.512-10.496t10.496-24.992-10.496-24.992-24.512-10.496z m107.008-111.008h-214.016q-14.016 0-24.512 10.496t-10.496 24.992 10.496 24.992 24.512 10.496h214.016q14.016 0 24-10.496t10.016-24.992-10.016-24.992-24-10.496z m-240.992 36q0 4 0.992 8-0.992-4-0.992-8zM700 512z m12 52l4-2.016z m-260.992-135.488q0 14.496 10.496 24.992t24.512 10.496h214.016q14.016 0 24-10.496t10.016-24.992-10.016-24.992-24-10.496h-214.016q-14.016 0-24.512 10.496t-10.496 24.992z m8 1.504z" p-id="4436"></path></svg>
            </label>
            <span class="file-path">文件：${path.basename(
              variable.filePath
            )}</span>
            </div>
            `
          })
          .join('')

        return `
        <details class="color-group">
          <summary>
            <div class="color-preview" style="background-color: ${colorValue}"></div>
            <span class="color-value">${colorValue}</span>
            <span class="var-count">(${group.variables.length} 个变量)</span>
          </summary>
          <div class="vars-container">${variablesHtml}</div>
        </details>
        `
      })
      .join('')

    const templatePath = vscode.Uri.joinPath(
      this._extensionUri,
      'public',
      'color-vars-template.html'
    ).fsPath
    // 读取 HTML 模板文件
    const template = fs.readFileSync(templatePath, 'utf-8')
    const htmlContent = template.replace('${colorGroupsHtml}', colorGroupsHtml)
    return htmlContent
  }
}
