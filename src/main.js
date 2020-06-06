
//import * as net from "net";
// noble / bleno
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
//const expat = require('node-expat');
// xml-js
const { DOMParser } = require('xmldom');
//const xmlToJSON = require('p3x-xml2json');
//const ref = require("ref");
//const ArrayType = require('ref-array')
//const ffi = require("ffi");
//var Struct = require('ref-struct');
const dates = require('./dates.js');
const classdef = require('./classdef.js');

//const homeDir = os.homedir();
//readOldConfig(homedir);

const electronVersion = require('electron-version')
electronVersion(function (err, v) {
  console.log(err, v) // null 'v0.33.4'
})

connections = {};   // Defined connections
classDefs = {};     // All defined classes/types
childWindows = [];  // All child windows
pathHome = path.join(app.getPath('home'), ".vscpworks");
pathVSCP = '';

let mainWindow;         // Initial window

console.log('Homefolder: ' + pathHome);

console.log("Platform: " + os.platform());
switch (os.platform()) {

  case "aix":
    break;

  case "darwin":
    break;

  case "linux":
    pathVSCP = "/var/lib/vscp/";
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

// Create events folder in home folder if it does not exist
// already
if (!fs.existsSync(path.join(pathHome, 'events'))) {
  fs.mkdir(path.join(pathHome, 'events'), { recursive: true }, (err) => {
    if (err) throw err;
  });
}

let pathConnectConfig = path.join(pathHome, 'connections.json');
console.log('Path to connections: ' + pathConnectConfig);

let pathEvents = path.join(pathHome, 'events');
console.log('Path to class/type definitions: ' + pathEvents);

// Read in defined connections if they are there
try {
  if (fs.existsSync(pathConnectConfig)) {
    let rawdata = fs.readFileSync(pathConnectConfig);
    connections = JSON.parse(rawdata);

    connections.interface = sortConnections(connections);
  }
}
catch (err) {
  console.error("Failed to fetch predefined connections from " + pathConnectConfig);
  console.error(err);
}


// Check if there is new class definitions available
// and download them if so.
classdef.checkForNewClassDefs(pathEvents, (cdef) => {
  classDefs = cdef;
  // Find class
  var foundClass = classDefs.find((element) => element.class === 10);
  // Find type in class
  var foundType = foundClass.types.find((element) => element.type === 10);
});


///////////////////////////////////////////////////////////////////////////////
// sortConnections
//

function sortConnections(conn) {
  nameArray = [];
  conn.interface.forEach((item) => {
    nameArray.push(item.name.toLowerCase());
  });
  nameArray.sort();

  newConnections = [];
  nameArray.forEach((name) => {
    newConnections.push(conn.interface.find((element) => {
      return element.name.toLowerCase() == name;
    }));
  });

  return newConnections;
}

///////////////////////////////////////////////////////////////////////////////
// createMainWindow
//

function createMainWindow() {

  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    height: 500,
    width: 800,
    icon: path.join(__dirname, './assets/icons/png/logo_64.png'),
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    },
  });

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Show main window when it's ready to be displayed
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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

///////////////////////////////////////////////////////////////////////////////
// newSessionWindow
//

function newSessionWindow(connection_name) {

  // Create the browser window.
  let win = new BrowserWindow({
    show: false,
    height: 850,
    width: 1200,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    },
  });

  childWindows.push({
    id: win.id,
    window: win,
    type: 'session',
    connection_name: connection_name
  });

  // Open the DevTools.
  win.webContents.openDevTools();

  // Show main window when it's ready to be displayed
  win.once('ready-to-show', () => {
    win.show();
  });

  win.on("close", () => {
    for (let i = 0; i < childWindows.length; i++) {
      if (win.id === childWindows[i].id) {
        // Remove
        childWindows.splice(i, 1);
        break;
      }
    }
  });

  // Emitted when the window is closed.
  win.on("closed", () => {
    win = null;
  });

  // and load the index.html of the app.
  win.loadFile(path.join(__dirname, "../session.html"));

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
    //'parent': parent,
    'show': false,
    'modal': true,
    'alwaysOnTop': true,
    'title': options.title,
    'autoHideMenuBar': true,
    'webPreferences': {
      "nodeIntegration": true,
      enableRemoteModule: true,
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


function dialogModalex(options) {

  return new Promise(resolve => {

    dialogOptions = options;  // Save options

    dialogWindow = new BrowserWindow({
      'width': options.width,
      'height': options.height,
      'show': false,
      'modal': true,
      'alwaysOnTop': true,
      'title': options.title,
      'autoHideMenuBar': true,
      'webPreferences': {
        "nodeIntegration": true,
        enableRemoteModule: true,
        "sandbox": false
      }
    });
  
    // Open the DevTools.
    dialogWindow.webContents.openDevTools();

    dialogWindow.on('closed', () => {
      dialogWindow = null;
      resolve(dialogAnswer);
    });

    // Load the HTML dialog box page
    dialogWindow.loadFile(path.join(__dirname, options.url));

    // Show it when loaded
    dialogWindow.once('ready-to-show', () => {
      dialogWindow.setTitle(dialogOptions.title);
      dialogWindow.show();
    });

  });
}

///////////////////////////////////////////////////////////////////////////////
// Get connection object from it's name
//

function getConnection(name) {

  return new Promise(resolve => {
  
    for (let i = 0; i < connections.interface.length; i++) {
      if ("undefined" === typeof connections.interface[i].name) continue;
      if (name.toLowerCase() === connections.interface[i].name.toLowerCase()) {
        // Interface found
        resolve(connections.interface[i]);
        break;
      }
    };

    // Named interface was not found
    resolve(null);

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

ipcMain.handle("open-modal-dialog", async (event, arg) => {
  const result = await dialogModalex(arg);
  return result;
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

ipcMain.handle("get-named-connection", async (event, name) => {
  const result = await getConnection(name);
  return result;
});

// ipcMain.on('get-named-connection', (event, name) => {
//   rv = null;
//   for (let i = 0; i < connections.interface.length; i++) {
//     if ("undefined" === typeof connections.interface[i].name) continue;
//     if (name.toLowerCase() === connections.interface[i].name.toLowerCase()) {
//       rv = connections.interface[i];
//       break;
//     }
//   };
//   event.returnValue = rv;
// });

///////////////////////////////////////////////////////////////////////////////
// Called to add a new connection object
//

ipcMain.on('add-connection', (event, item) => {
  connections.interface.push(item);
  if (!saveConnections()) {

  }
});

///////////////////////////////////////////////////////////////////////////////
// Called to change an existing connection object
//

ipcMain.on('edit-connection', (event, item) => {
  //connections.interface.push(item);
  for (let i = 0; i < connections.interface.length; i++) {
    if (item.name === connections.interface[i].name) {
      connections.interface[i] = item;
      break;
    }
  }
  if (!saveConnections()) {

  }
});

///////////////////////////////////////////////////////////////////////////////
// Called to remove a connection object
//

ipcMain.on('remove-connection', (event, name) => {
  for (let i = 0; i < connections.interface.length; i++) {
    if (name === connections.interface[i].name) {
      connections.interface.splice(i, 1); // Remove it
      break;
    }
  }
  if (!saveConnections()) {

  }
});

///////////////////////////////////////////////////////////////////////////////
// Called to clone a connection object
//

ipcMain.on('clone-connection', (event, name) => {

  let clone = {};

  // Find interface
  for (let i = 0; i < connections.interface.length; i++) {
    if (name === connections.interface[i].name) {
      // Alternative clone: var cloneOfA = JSON.parse(JSON.stringify(a));
      clone = cloneObj(connections.interface[i]);
      break;
    }
  }

  // Create new unique name
  let idx = 0;
  let bFound = true;
  let newname = '';
  while (bFound) {

    if (idx) {
      newname = "clone of " + clone.name + ' ' + idx;
    }
    else {
      newname = "clone of " + clone.name;
    }

    bFound = false;
    for (let i = 0; i < connections.interface.length; i++) {
      if (newname.toLowerCase() === connections.interface[i].name.toLowerCase()) {
        idx++;
        bFound = true;
        break;
      }
    }

    // Add the clone if not found
    if (!bFound) {
      clone.name = newname;
      connections.interface.push(clone);
    }

  }

  if (!saveConnections()) {

  }

});

///////////////////////////////////////////////////////////////////////////////
// Clone object
//

function cloneObj(obj) {
  if (null == obj || "object" != typeof obj) return obj;
  var copy = obj.constructor();
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  }
  return copy;
}

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

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get VSCP class/type object
//
// 'undefined' is returned if not found
//

ipcMain.on('get-classdefs', (event) => {
  event.sender.send('reply-classdefs', classDefs);
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get a specific VSCP class object
//
// 'undefined' is returned if VSCP class is not found
//

ipcMain.on('get-vscpclass-obj', (event, vscpclass) => {
  // Find VSCP class
  event.returnValue = classDefs.find((element) => element.class === vscpclass);
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get a specific VSCP type object for a specific
// VSCP class
//
// Object with vscpClass and vscpType objects are retured on success.
// 'undefined' is returned if VSCP class and/or VSCP type is not found.
//

ipcMain.on('get-vscptype-obj', (event, vscpclass, vscptype) => {
  // Find VSCP class
  let foundClass = classDefs.find((element) => element.class === vscpclass);

  // Find type in class
  let foundType = foundClass.types.find((element) => element.type === vscptype);

  event.returnValue = {vscpClass: foundClass, vscpType: foundType};
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get the connection object
//
// connection_name - Selected connection

ipcMain.on('open-new-session-window', (event, connection_name) => {
  newSessionWindow(connection_name);
});

///////////////////////////////////////////////////////////////////////////////
// Called by the application to get the child window object for a child window
// with a specific id
//
// connection_name - Selected connection
//

ipcMain.on('get-named-child-window-record', (event, id) => {
  rv = null;
  for (let i=0; i<childWindows.length;i++ ) {
    if ( id === childWindows[i].id ) {
      rv = childWindows[i];
      break;
    }
  }

  event.returnValue = rv;
});


// ---------


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
      nodeIntegration: true,
      enableRemoteModule: true
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
      nodeIntegration: true,
      enableRemoteModule: true
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
    // Sort
    connections.interface = sortConnections(connections);
    // Save
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

const vscp = require('node-vscp');
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


//-------------------------------------------------------

/* var bArray = ArrayType(ref.types.uchar);

let canalEvent_t = ref.types.void;
let canalData_t = ref.types.uchar;
let canalEventPtr_t = ref.refType(canalEvent_t);
let canalDataPtr_t = ref.refType(canalData_t);
let canalDataPtrPtr_t = ref.refType(canalDataPtr_t);

// binding to CANAL functions...
var libcanal = ffi.Library('/var/lib/vscp/drivers/level1/vscpl1drv-logger.so', {
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
console.log(rv); */