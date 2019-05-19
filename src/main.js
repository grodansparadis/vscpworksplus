
//import * as net from "net";
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const os = require('os');
const fs = require('fs');
const path = require('path');
const expat = require('node-expat');
const { DOMParser } = require('xmldom');
const xmlToJSON = require('xml2json');
const ref = require("ref");
const ArrayType = require('ref-array')
const ffi = require("ffi");
var Struct = require('ref-struct');

//const homeDir = os.homedir();
//readOldConfig(homedir);

let connections = {};   // Defined connections
let mainWindow;         // Initial window
let childWindows = [];

let pathHome = path.join(app.getPath('home'), ".vscpworks");
console.log('Homefolder :' + pathHome);

let pathVSCP = '';

console.log("Platform: " + os.platform() );
switch (os.platform()) {

  case "aix":
    break;

  case "darwin":
    break;

  case "linux":
    pathVSCP = "/srv/vscp/";
    break;

  case "freebsd":
    break;

  case "openbsd":
    break;

  case "sunos":
    break;

  case "win32":
    break;
}

// Create home folder if it does not exist
if (!fs.existsSync(pathHome)) {
  fs.mkdir(pathHome, { recursive: true }, (err) => {
    if (err) throw err;
  });
}

let pathConnectConfig = path.join(pathHome, 'connections.json');
console.log(pathConnectConfig);
// Read in connections if they are there
try {
  if (fs.existsSync(pathConnectConfig)) {
    let rawdata = fs.readFileSync(pathConnectConfig);
    console.log(connections);
    connections = JSON.parse(rawdata);
    //console.log(connections);
  }
}
catch (err) {
  console.error("Failed to fetch predefined connections from " + pathConnectConfig);
  console.error(err);
}


///////////////////////////////////////////////////////////////////////////////
// createMainWindow
//

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
  mainWindow.webContents.openDevTools();

  // Show main window when it's ready to be displayed
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // console.log(dialog.showOpenDialog({
    //   properties: ['openFile', 'openDirectory', 'multiSelections']
    // }));
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

//-----------------------------------------------------------------------------

let dialogWindow = null;
let dialogOptions = {};
let dialogAnswer = {};

///////////////////////////////////////////////////////////////////////////////
// dialogModal
//
// Creating a modal dialog
//

function dialogModal(parent, options, callback) {

  dialogOptions = options;  // Save options

  dialogWindow = new BrowserWindow({
    'width': options.width,
    'height': options.height,
    'parent': parent,
    'show': false,
    'modal': true,
    'alwaysOnTop': true,
    'title': options.title,
    'autoHideMenuBar': true,
    'webPreferences': {
      "nodeIntegration": true,
      "sandbox": false
    }
  });

  // Open the DevTools.
  dialogWindow.webContents.openDevTools();

  dialogWindow.on('closed', () => {
    dialogWindow = null
    callback(dialogAnswer);
  });

  // Load the HTML dialog box page
  dialogWindow.loadFile(path.join(__dirname, options.url));

  // Show it when loaded
  dialogWindow.once('ready-to-show', () => {
    dialogWindow.setTitle(dialogOptions.title);
    dialogWindow.show();
  });
}

///////////////////////////////////////////////////////////////////////////////
// Called by the dialog box to get its parameters
//

ipcMain.on("dialog-open", (event, data) => {
  event.returnValue = JSON.stringify(dialogOptions, null, '');
})

///////////////////////////////////////////////////////////////////////////////
// Called by the dialog box when closed
//

ipcMain.on("dialog-close", (event, data) => {
  dialogAnswer = data;
})

///////////////////////////////////////////////////////////////////////////////
// Called by the application to open the prompt dialog
//

ipcMain.on("open-modal-dialog", (event, arg) => {
  dialogModal(arg.win, arg, (data) => {
    event.returnValue = data
  });
});

//-----------------------------------------------------------------------------



///////////////////////////////////////////////////////////////////////////////
// Called by the application to get the connection object
//

ipcMain.on('get-connection-object', (event, arg) => {
  event.returnValue = connections
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get a named connection object
//

ipcMain.on('get-named-connection', (event, name) => {
  rv = null;
  for (let i = 0; i < connections.vscpinterface.length; i++) {
    if ("undefined" === typeof connections.vscpinterface[i].name) continue;
    if (name.toLowerCase() === connections.vscpinterface[i].name.toLowerCase()) {
      rv = connections.vscpinterface[i];
      break;
    }
  };
  event.returnValue = rv;
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get a named connection object
//

ipcMain.on('add-connection', (event, item) => {
  connections.vscpinterface.push(item);
  if (!saveConnections()) {

  }
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get the home folder
//

ipcMain.on('get-home-folder', (event) => {
  event.returnValue = pathHome
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get the VSCP daemon folder
//

ipcMain.on('get-daemon-folder', (event) => {
  event.returnValue = pathVSCP
});


///////////////////////////////////////////////////////////////////////////////
// Called by the application to get a named connection object
//

ipcMain.on('show-dialog-message', (event, parent, options) => {
  dialog.showMessageBox(mainWindow, options, () => {

  });
});



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

function selectConnetionType() {
  let child = new BrowserWindow({
    parent: mainWindow,
    show: false,
    modal: true,
    width: 600,
    height: 500,
    webPreferences: {
      nodeIntegration: true
    },
  });
  child.loadFile(path.join(__dirname, "../dialog_new_connection.html"));
  child.show();
}

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

///////////////////////////////////////////////////////////////////////////////
// saveConnections
//
// Save the connection object
//
// @return true on success, false otherwise
//

let saveConnections = function () {
  try {
    fs.writeFileSync(pathConnectConfig, JSON.stringify(connections), 'utf-8');
    console.log("Saved connection config file");
    return true;
  }
  catch (err) {
    console.error('Failed to save connections. Path = ' + pathConnectConfig);
    console.error(err);
  }

  return false;
}

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
const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');

// let success = function (obj) {
//   console.log("success ");
//   console.log(obj);
// }

// let aaaa = function (aaa) {
//   console.log("[aaaa] interface success ");
//   console.log(aaa);
// }

// let pppp = function (aaa) {
//   console.log("[pppp] quit success ");
//   console.log(aaa);
// }

// let tttt = function (aaa) {
//   console.log("[tttt] connect success ");
//   console.log(aaa);
//   vscp_tcp_client.disconnect(
//     {
//       onSuccess: pppp
//     }
//   );
// }

// function test1() {
//   var start = new Date().getTime();
//   let vscp_tcp_client = new vscp_tcp_Client();
//   vscp_tcp_client.connect(
//     {
//       host: "pi4",
//       port: 9598,
//       timeout: 10000,
//       onSuccess: null
//     })
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "noop"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "noop"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "noop"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "user",
//         argument: "admin"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "pass",
//         argument: "secret"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "interface",
//         argument: "list",
//         onSuccess: aaaa
//       }))
//     .then(obj => {
//       console.log('Last');
//       console.log(obj);
//       vscp_tcp_client.disconnect();
//     })
//     .then(obj => {
//       var end = new Date().getTime();
//       var time = end - start;
//       console.log('Execution time: ' + time)
//     })
//     .catch(err => console.log("Catch Error " + err.message));
//   ;
// }

// const test2 = async () => {
//   var start = new Date().getTime();
//   let vscp_tcp_client = new vscp_tcp_Client();
//   const value1 = await vscp_tcp_client.connect(
//     {
//       host: "localhost",
//       port: 9598,
//       timeout: 10000,
//       onSuccess: null
//     });
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "noop"
//     });
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "noop"
//     });
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "noop"
//     });
//   const ttt = await vscp_tcp_client.sendCommand(
//     {
//       command: "user",
//       argument: "admin"
//     });
//   console.log(ttt);
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "pass",
//       argument: "secret"
//     });
//   const iff = await vscp_tcp_client.sendCommand(
//     {
//       command: "interface",
//       argument: "list",
//       onSuccess: aaaa
//     });
//   console.log(parseInterface(iff));
//   const iff = await vscp_tcp_client.getInterfaces();
//   console.log(iff);
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "noop"
//     });
//   const iff2 = await vscp_tcp_client.getInterfaces();
//   console.log(iff2);
//   const ver = await vscp_tcp_client.getRemoteVersion();
//   console.log(ver);

//   const cnt = await vscp_tcp_client.getPendingEventCount();
//   console.log(cnt);

//   console.log(vscp.version.major);
//   console.log(vscp.varTypes);
//   console.log(vscp.varTypeNames[1]);
//   console.log(vscp);

//   const varCreate = await vscp_tcp_client.writeVar({
//     name: "tttt",
//     value: 'This is a test åäöÅÄÖ',
//     note: 'This is a super variable åäöÅÄÖ'
//   });
//   console.log(varCreate);

//   const varList = await vscp_tcp_client.listVar({
//     onSuccess: success,
//     regex: 'tttt'
//   });
//   console.log(varList);

//   const varRead = await vscp_tcp_client.readVar({
//     name: 'tttt'
//   });
//   console.log(varRead);

//   const varReadValue = await vscp_tcp_client.readVarValue({
//     name: 'tttt'
//   });
//   console.log(varReadValue);

//   const varWriteValue = await vscp_tcp_client.writeVarValue({
//     name: 'tttt',
//     value: 'Det här är det nya värdet'
//   });
//   console.log(varWriteValue);

//   const varReadValue2 = await vscp_tcp_client.readVarValue({
//     name: 'tttt'
//   });
//   console.log(varReadValue2);

//   const varReadNote = await vscp_tcp_client.readVarNote({
//      onSuccess: success,
//      name: 'tttt'
//    });
//   console.log(varReadNote);

//   await vscp_tcp_client.disconnect();
//   var end = new Date().getTime();
//   var time = end - start;
//   console.log('Execution time: ' + time);
// }


// const test3 = async () => {

//   let vscp_tcp_client = new vscp_tcp_Client();

//   vscp_tcp_client.addEventListener((e) => {
//     console.log("Event received");
//   });

//   const value1 = await vscp_tcp_client.connect(
//     {
//       host: "localhost",
//       port: 9598,
//       timeout: 10000,
//       onSuccess: null
//     });
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "noop"
//     });
//   const ttt = await vscp_tcp_client.sendCommand(
//     {
//       command: "user",
//       argument: "admin"
//     });
//   console.log(ttt);
//   await vscp_tcp_client.sendCommand(
//     {
//       command: "pass",
//       argument: "secret"
//     });
//   await vscp_tcp_client.startRcvLoop();
// }

// function testPromise() {

//   var start = new Date().getTime();
//   let vscp_tcp_client = new vscp_tcp_Client();

//   vscp_tcp_client.connect(
//     {
//       host: "127.0.0.1",
//       port: 9598,
//       timeout: 10000,
//       onSuccess: null
//     })
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "noop"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "noop"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "noop"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "user",
//         argument: "admin"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "pass",
//         argument: "secret"
//       }))
//     .then((obj) => vscp_tcp_client.sendCommand(
//       {
//         command: "interface",
//         argument: "list",
//         onSuccess: aaaa
//       }))
//     .then(obj => {
//       console.log('Last command');
//       console.log(obj);
//       vscp_tcp_client.disconnect();
//     })
//     .then(obj => {
//       var end = new Date().getTime();
//       var time = end - start;
//       console.log('Execution time: ' + time)
//     })
//     .catch(err => console.log("Catch Error " + err.message));
//   ;
// }

// testPromise();

// testPromise().catch(err => {
//   console.log("Catching error");
//   console.log(err);
// })

// console.log(vscp_class.VSCP_CLASS2_MEASUREMENT_STR);
// console.log(vscp_type.VSCP_TYPE_PROTOCOL_ACTIVATE_NEW_IMAGE);
// console.log('--------------------------------->');
// console.log(vscp.version);
// console.log(vscp.constants_priorities);


// function readOldConfig(homedir) {
//   var parser = new expat.Parser('UTF-8')
//   var confdir = path.join(homedir, ".vscpworks/vscpworks.conf")
//   var oldconf = parser.toJson(confdir);
//   console.log(oldconf);

//   parser.on('startElement', function (name, attrs) {
//     console.log(name, attrs)
//   })

// function BufferToPointer(buf,offset,length)
// {
//     if (offset===undefined)
//         offset = 0;
//     if (length===undefined || length == -1)
//         length = buf.length - offset;
//     var ptr = new ffi.Pointer(length);
//     var ptr2 = ptr.seek(0);
//     var end = offset + length;
//     for (var i=offset;i<end;++i)
//     {
//         ptr2.putByte(buf[i],true);
//     }
//     return ptr;
// }

// function PointerToBuffer(ptr,length)
// {
//     var buf = new Buffer(length);
//     for(var i=0;i<length;++i)
//     {
//         buf.writeUInt8(ptr.getByte(true),i);
//     }
//     return buf;
// }

var bArray = ArrayType(ref.types.uchar);

let canalEvent_t = ref.types.void;
let canalData_t = ref.types.uchar;
let canalEventPtr_t = ref.refType(canalEvent_t);
let canalDataPtr_t = ref.refType(canalData_t);
let canalDataPtrPtr_t = ref.refType(canalDataPtr_t);

// binding to CANAL functions...
var libcanal = ffi.Library('/srv/vscp/drivers/level1/vscpl1drv-logger.so', {
  'CanalOpen': ['long', ['string', 'long']],
  'CanalSend': ['int', ['long', canalEventPtr_t]],
  'CanalClose': ['int', ['long']],
});

let flags_t = ref.types.ulong;
let obid_t = ref.types.ulong;
let id_t = ref.types.ulong;
let sizedata_t = ref.types.uchar;
let data_t = canalDataPtr_t;
let timestamp_t = ref.types.ulong;

// define the "timeval" struct type
var canalEvent = Struct({
  flags: flags_t,
  obid: obid_t,
  id: id_t,
  sizeData: sizedata_t,
  data: data_t,
  timestamp: timestamp_t
});

let rv = 0;
let h = libcanal.CanalOpen('/tmp/test.txt;0x0;0x0', 1);
console.log(h);

var dataArray = new bArray(8); //ref.alloc('uchar', 8); //new Buffer(8); //new bArray(8);
const arr = new Uint8Array(8);
arr[0] = 11;
arr[1] = 22;
arr[2] = 33;
arr[3] = 44;
arr[4] = 55;
arr[5] = 66;
arr[6] = 77;
arr[7] = 88;
console.log(arr);
console.log(arr.data);
dataArray[0] = 11;
dataArray[1] = 22;
dataArray[2] = 33;
dataArray[3] = 44;
dataArray[4] = 55;
dataArray[5] = 66;
dataArray[6] = 77;
dataArray[7] = 88;
console.log(dataArray);
var ev = new canalEvent;
ev.flags = 1;     // Extended
ev.timestamp = 0x4321;
ev.obid = 0x1234; // Not used
ev.id = 0x999;
ev.data = arr; //dataArray.ref(); //ref.address(dataArray);
ev.sizeData = 8;

// ev.data = data;
rv = libcanal.CanalSend(h, ev.ref());
console.log(rv);

rv = libcanal.CanalClose(h);
console.log(rv);