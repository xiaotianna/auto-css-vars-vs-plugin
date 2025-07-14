import * as vscode from 'vscode';
import { ColorVarsWebviewViewProvider } from './views/ColorVarsWebviewViewProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ColorVarsWebviewViewProvider.viewType,
      new ColorVarsWebviewViewProvider(context.extensionUri)
    )
  );
}

export function deactivate() {}
