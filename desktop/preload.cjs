const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codereoDesktop', Object.freeze({
  isAvailable: true,
  platform: process.platform,
  openWorkspace: () => ipcRenderer.invoke('codereo:open-workspace'),
  saveWorkspace: (files, expectedBaselines) => ipcRenderer.invoke('codereo:save-workspace', files, expectedBaselines),
  deleteWorkspaceFiles: (paths) => ipcRenderer.invoke('codereo:delete-workspace-files', paths),
  runValidation: (commands) => ipcRenderer.invoke('codereo:run-validation', commands),
  runConfirmedCommand: (command) => ipcRenderer.invoke('codereo:run-confirmed-command', command),
}));
