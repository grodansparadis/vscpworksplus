import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";

let mainWindow: Electron.BrowserWindow;

function createWindow() {

  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    height: 400,
    width: 700,
  });

  // and load the index.html of the app.
  mainWindow.loadFile( path.join( __dirname, "../main.html" ) );

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Show main window when it's ready to be displayed
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    //console.log(dialog.showOpenDialog({
    //  properties: ['openFile', 'openDirectory', 'multiSelections']
    //}));
  });

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });


}

ipcMain.on('asynchronous-message', (event: any, arg: any) => {
  console.log("async " + arg) // prints "ping"
  event.sender.send('asynchronous-reply', 'pong')
})

ipcMain.on('synchronous-message', (event: any, arg: any) => {
  console.log("sync " + arg) // prints "ping"
  event.returnValue = 'pong'
})

ipcMain.on('open-second-window', (event: any, arg: any) => {
  //secondWindow.show()
})

ipcMain.on('close-second-window', (event: any, arg: any) => {
  //secondWindow.hide()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

function ttt() {
  let child = new BrowserWindow({ parent: mainWindow });
  mainWindow.loadFile(path.join(__dirname, "../index.html"));
  child.show();
}