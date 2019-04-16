import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";

let mainWindow: Electron.BrowserWindow;
let childWindows: any = [];

let path_home: string = path.join(app.getPath('home'), ".vscpworks")

// Create home folder if it does not exist
if (!fs.existsSync(path_home)) {
  fs.mkdir(path_home, { recursive: true }, (err) => {
    if (err) throw err;
  });
}

function createMainWindow() {

  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    height: 420,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../main.html"));

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

/* ipcMain.on('asynchronous-message', (event: any, arg: any) => {
  console.log("async " + arg) // prints "ping"
  event.sender.send('asynchronous-reply', 'pong')
})

ipcMain.on('synchronous-message', (event: any, arg: any) => {
  console.log("sync " + arg) // prints "ping"
  event.returnValue = 'pong'
  ttt();
}) */

ipcMain.on('open-second-window', (event: any, arg: any) => {
  //secondWindow.show()
})

ipcMain.on('close-second-window', (event: any, arg: any) => {
  //secondWindow.hide()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createMainWindow);

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
    createMainWindow();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

function ttt() {
  let child = new BrowserWindow({
    show: false,
    height: 600,
    width: 1024,
    webPreferences: {
      nodeIntegration: true
    },
  });
  child.loadFile(path.join(__dirname, "../register.html"));
  child.show();
}

/* var client = new net.Socket();
client.connect(9598, '127.0.0.1', function() {
	console.log('Connected');
  client.write('user admin\r\n');
  client.write('pass secret\r\n');
});

client.on('data', function(data) {
	console.log('Received: ' + data);
	//client.destroy(); // kill client after server's response
});

client.on('close', function() {
	console.log('Connection closed');
}); */

const vscpclient = require('../src/node-vscp-tcpip-client.js')

/* async function run()  { */

let state = 0;
let connection = new vscpclient()

let params = {
  host: 'vscp1.vscp.org',
  port: 9598,
  timeout: 3000,
}

connection.on('ready', function (response: any) {

  console.log(connection.cmdResponse);

  if (0 === state) {
    connection.docmd("user admin", function (response: any) {
      console.log(`>>> ${state} ` + response);
      console.log(connection.cmdResponse);
      state++;
    });
  } else if (1 === state) {
    connection.docmd("pass secret", function (response: any) {
      console.log(`>>> ${state} ` + response);
      console.log(connection.cmdResponse);
      state++;
    });
  }
  else {
    console.log(`<<< ${state} `);
    state++;
  }
})

connection.on('timeout', function () {
  console.log('socket timeout!')
  connection.end()
})

connection.on('end', function () {
  console.log('connection end')
})

connection.on('close', function () {
  console.log('connection closed')
})

connection.connect(params);

/* try {
  await connection.connect(params);
} catch (error) {
  // handle the throw (timeout)
  console.log('Error:' + error);
}

let res: any;
try {
  res = await connection.docmd('user admin');
} catch (error) {
  // handle the throw (timeout)
  console.log('Error:' + error);
}

try {
  res = await connection.docmd('pass secret');
} catch (error) {
  // handle the throw (timeout)
  console.log('Error:' + error);
}

try {
  res = await connection.docmd('quit');
} catch (error) {
  // handle the throw (timeout)
  console.log('Error:' + error);
}

//console.log('async result:', res);

connection.on('ready', function () {
  /* console.log('ready'); */
  //}); * /
//}

// run()