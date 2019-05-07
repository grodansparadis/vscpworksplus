//import * as net from "net";
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require('fs');
const path = require('path');
//const ipcRenderer  = electron.ipcRenderer;

let mainWindow;
let childWindows = [];

let path_home = path.join(app.getPath('home'), ".vscpworks")

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

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  // Show main window when it's ready to be displayed
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window is visible');
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

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../main.html"));

}

// ipcMain.on('asynchronous-message', (event: any, arg: any) => {
//   console.log("async " + arg) // prints "ping"
//   event.sender.send('asynchronous-reply', 'pong')
// })

// ipcMain.on('synchronous-message', (event: any, arg: any) => {
//   console.log("sync " + arg) // prints "ping"
//   event.returnValue = 'pong'
//   ttt();
// })

// ipcMain.on('open-second-window', (event: any, arg: any) => {
//   //secondWindow.show()
// })

// ipcMain.on('close-second-window', (event: any, arg: any) => {
//   //secondWindow.hide()
// })

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

// TODO - NEED SOLUTION TO CATCH ECONNREFUSED
process.on('uncaughtException', function (err) {
  console.log('-------------> uncaughtException');
  console.log(err);
});

const vscp = require('./vscp');
const vscp_tcp_Client = require('../src/vscptcp');
//import vscp_tcp_Client from '../@types/vscptcp'
//const mod = require('../src/vscptcp');

let success = function (obj) {
  console.log("success ");
  console.log(obj);
}

let aaaa = function (aaa) {
  console.log("[aaaa] interface success ");
  console.log(aaa);
}

let pppp = function (aaa) {
  console.log("[pppp] quit success ");
  console.log(aaa);
}

let tttt = function (aaa) {
  console.log("[tttt] connect success ");
  console.log(aaa);
  vscp_tcp_client.disconnect(
    {
      onSuccess: pppp
    }
  );
}

let parseInterface = function (rv) {
  let interfaces = [];
  let cntElements = rv.response.length;
  if (rv.response.length &&
    (rv.command === 'interface') &&
    (rv.response[cntElements - 1]) === '+OK') {
    rv.response.pop(); // remove '+OK'
    rv.response.forEach((item) => {
      let items = item.split(',');
      let obj = {};
      obj.index = parseInt(items[0]);
      obj.type = parseInt(items[1]);
      obj.guid = vscp.strToGuid(items[2]);
      obj.name = items[3].split('|')[0];
      let startstr = items[3].split('|')[1].substr()
      obj.started = startstr.substr(startstr.length - 19);
      interfaces.push(obj);
    });
  }
  return interfaces;
}

function test1() {
  var start = new Date().getTime();
  let vscp_tcp_client = new vscp_tcp_Client();
  vscp_tcp_client.connect(
    {
      host: "pi4",
      port: 9598,
      timeout: 10000,
      onSuccess: null
    })
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "noop"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "noop"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "noop"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "user",
        argument: "admin"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "pass",
        argument: "secret"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "interface",
        argument: "list",
        onSuccess: aaaa
      }))
    .then(obj => {
      console.log('Last');
      console.log(obj);
      vscp_tcp_client.disconnect();
    })
    .then(obj => {
      var end = new Date().getTime();
      var time = end - start;
      console.log('Execution time: ' + time)
    })
    .catch(err => console.log("Catch Error " + err.message));
  ;
}

const test2 = async () => {
  var start = new Date().getTime();
  let vscp_tcp_client = new vscp_tcp_Client();
  const value1 = await vscp_tcp_client.connect(
    {
      host: "pi4",
      port: 9598,
      timeout: 10000,
      onSuccess: null
    });
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });
  const ttt = await vscp_tcp_client.sendCommand(
    {
      command: "user",
      argument: "admin"
    });
  console.log(ttt);
  await vscp_tcp_client.sendCommand(
    {
      command: "pass",
      argument: "secret"
    });
  // const iff = await vscp_tcp_client.sendCommand(
  //   {
  //     command: "interface",
  //     argument: "list",
  //     onSuccess: aaaa
  //   });
  // console.log(parseInterface(iff));
  const iff = await vscp_tcp_client.getInterfaces();
  console.log(iff);
  // await vscp_tcp_client.sendCommand(
  //   {
  //     command: "noop"
  //   });
  // const iff2 = await vscp_tcp_client.getInterfaces();
  // console.log(iff2);
  const ver = await vscp_tcp_client.getRemoteVersion();
  console.log(ver);

  const cnt = await vscp_tcp_client.getPendingEventCount();
  console.log(cnt);

  // console.log(vscp.version.major);
  // console.log(vscp.varTypes);
  // console.log(vscp.varTypeNames[1]);
  // console.log(vscp);

  const varCreate = await vscp_tcp_client.createVar({
    name: "tttt",
    value: 'This is a test'
  });
  console.log(varCreate);

  const varList = await vscp_tcp_client.listVar({
    onSuccess: success,
    regex: 'tttt'
  });
  console.log(varList);

  await vscp_tcp_client.disconnect();
  var end = new Date().getTime();
  var time = end - start;
  console.log('Execution time: ' + time);
}


//test1();
test2().catch(err => {
  console.log("Catching error");
  console.log(err);
})



console.log('--------------------------------->');
console.log(vscp.version);
console.log(vscp.constants_priorities);