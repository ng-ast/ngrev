import { app, BrowserWindow, dialog, MenuItem, MenuItemConstructorOptions, MessageBoxReturnValue } from "electron";
import { Message } from "../../shared/ipc-constants";
import { getConfig } from "../config";

export enum MenuIndex {
  Ngrev
}

export enum SubmenuIndex {
  Themes = 0,
  ShowLibs = 1,
  ShowModulesOnly = 2,
  Export = 4,
  FitView = 6,
  Reset = 7,
  Quit = 8
}

export const applicationMenuTemplate = (
  themeChange: (name: string) => void,
  libsToggle: () => void,
  modulesOnlyToggle: () => void
): MenuItemConstructorOptions | MenuItem => {
  return {
    label: "ngrev",
    submenu: [
      {
        label: "Themes",
        submenu: Object.keys(getConfig().themes || []).map((label: string) => {
          return {
            label,
            type: "radio",
            checked: label === getConfig().theme,
            click() {
              const window = BrowserWindow.getAllWindows()[0];
              themeChange(label);
              window.webContents.send(Message.ChangeTheme, label);
            },
          };
        }),
      },
      {
        label: "Show libs",
        type: "checkbox",
        checked: getConfig().showLibs,
        accelerator: "CmdOrCtrl+L",
        click() {
          const window = BrowserWindow.getAllWindows()[0];
          libsToggle();
          window.webContents.send(Message.ToggleLibsMenuAction);
        },
      },
      {
        label: "Show modules only",
        type: "checkbox",
        checked: getConfig().showModules,
        accelerator: "CmdOrCtrl+M",
        click() {
          const window = BrowserWindow.getAllWindows()[0];
          modulesOnlyToggle();
          window.webContents.send(Message.ToggleModulesMenuAction);
        },
      },
      {
        type: "separator"
      },
      {
        label: "Export",
        accelerator: "CmdOrCtrl+E",
        enabled: false,
        click() {
          const window = BrowserWindow.getAllWindows()[0];
          window.webContents.send(Message.SaveImage);
        },
      },
      {
        type: "separator"
      },
      {
        label: "Fit view",
        accelerator: "CmdOrCtrl+F",
        click() {
          const window = BrowserWindow.getAllWindows()[0];
          window.webContents.send(Message.FitView);
        },
      },
      {
        label: "Reset",
        accelerator: "CmdOrCtrl+R",
        click() {
          const focusedWindow: BrowserWindow | null = BrowserWindow.getFocusedWindow();
          if (!focusedWindow) {
            return;
          }
          dialog
            .showMessageBox(focusedWindow, {
              type: "warning",
              buttons: ["OK", "Cancel"],
              title: "Are you sure?",
              message:
                "Your progress will be lost. Are you sure you want to refresh and select a new project?",
            })
            .then((message: MessageBoxReturnValue) => {
              if (!message.response) {
                BrowserWindow.getAllWindows().forEach((w: BrowserWindow) =>
                  w.webContents.reloadIgnoringCache()
                );
              }
            });
        },
      },
      {
        label: "Quit",
        accelerator: "CmdOrCtrl+Q",
        click() {
          app.quit();
        },
      },
    ],
  };
};
