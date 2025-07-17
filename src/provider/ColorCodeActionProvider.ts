import * as vscode from 'vscode'

export class ColorCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ]

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []
    const diagnostics = context.diagnostics

    for (const diagnostic of diagnostics) {
      if (
        diagnostic.message.includes('color') ||
        diagnostic.message.includes('#')
      ) {
        const action = new vscode.CodeAction(
          '替换为CSS变量',
          vscode.CodeActionKind.QuickFix
        )
        action.command = {
          command: 'auto-css-vars.replaceColors',
          title: '替换颜色值为CSS变量'
        }
        actions.push(action)
      }
    }

    return actions
  }
}
