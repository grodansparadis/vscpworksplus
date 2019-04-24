import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
let VSCPClient = require('../src/vscptcp');

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


// ------------------------------------------------------------------

// let wrkResponse: string = '';
// let response: any = [];
// let bOK: any = false;

// const client = net.createConnection({ host: '192.168.1.6', port: 9598 }, () => {
//   console.log('connected to server!');
//   // client.write('user admin\r\n');
//   // client.write('pass secret\r\n');
// });

// client.on('data', (chunk: any) => {
//   console.log(chunk.toString());
//   parseData(chunk);
// });
// client.on('end', () => {
//   console.log('disconnected from server');
// });

// // Parse response data
// function parseData(chunk: any) {

//   wrkResponse += chunk.toString();
//   let idx = wrkResponse.search("\\+OK -|-OK -");

//   // if no +OK found continue to collect data
//   if (idx === -1 ) {
//     return;
//   }

//   // Make response string array
//   response = wrkResponse.split("\r\n");
//   wrkResponse = '';

//   // remove \r\n ending to get nice table
//   response.pop();

// }

// // Send (do/exec) command
// docmd = function (sock, cmd ) {

//   cmd += '\r\n';

//   if (sock.writable) {

//     sock.write(cmd, function () {

//       self.vscptcpState = 'response';
//       self.emit('writedone');

//     });

//   }

// }

// ------------------------------------------------------------------

//const axios = require('axios');
// import axios from 'axios';
// const xml2js = require('xml2js');

// const parser = new xml2js.Parser();

// axios.get('http://www.eurosource.se/paris_010.xml')
//   .then((response: any) => {
//     //console.dir(response);
//     parser.parseString(response.data, (err: string, result:any) => {
//       // console.dir('# events: ' + result.vscp.module[0].events[0].event.length);
//       // console.dir(result.vscp.module[0].events[0].event);
//       // for (let reg of result.vscp.module[0].registers[0].reg) {
//       //   console.log(reg.description[0]._);
//       // }
//       console.log(result.vscp.module[0].manual[0].$.path);
//     });

//   })
//   .catch((err: string) => {
//     console.log(err);
//   });

  // ------------------------------------------------------------------

  let t8 = new VSCPClient;
  t8.connect({});
