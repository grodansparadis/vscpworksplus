"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var net = __importStar(require("net"));
var mainWindow;
var childWindows = [];
var path_home = path.join(electron_1.app.getPath('home'), ".vscpworks");
// Create home folder if it does not exist
if (!fs.existsSync(path_home)) {
    fs.mkdir(path_home, { recursive: true }, function (err) {
        if (err)
            throw err;
    });
}
function createMainWindow() {
    // Create the browser window.
    mainWindow = new electron_1.BrowserWindow({
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
    mainWindow.once('ready-to-show', function () {
        mainWindow.show();
        //console.log(dialog.showOpenDialog({
        //  properties: ['openFile', 'openDirectory', 'multiSelections']
        //}));
    });
    // Emitted when the window is closed.
    mainWindow.on("closed", function () {
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
electron_1.ipcMain.on('open-second-window', function (event, arg) {
    //secondWindow.show()
});
electron_1.ipcMain.on('close-second-window', function (event, arg) {
    //secondWindow.hide()
});
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
electron_1.app.on("ready", createMainWindow);
// Quit when all windows are closed.
electron_1.app.on("window-all-closed", function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", function () {
    // On OS X it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createMainWindow();
    }
});
// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
function ttt() {
    var child = new electron_1.BrowserWindow({
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
var wrkResponse = '';
var response = [];
var bOK = false;
var client = net.createConnection({ host: '192.168.1.6', port: 9598 }, function () {
    // 'connect' listener
    console.log('connected to server!');
    // client.write('user admin\r\n');
    // client.write('pass secret\r\n');
});
client.on('data', function (chunk) {
    console.log(chunk.toString());
    parseData(chunk);
});
client.on('end', function () {
    console.log('disconnected from server');
});
// Parse response data
function parseData(chunk) {
    wrkResponse += chunk.toString();
    var idx = wrkResponse.search("\\+OK -|-OK -");
    // if no +OK found continue to collect data
    if (idx === -1) {
        return;
    }
    // Make response string array
    response = wrkResponse.split("\r\n");
    wrkResponse = '';
    // remove \r\n ending to get nice table
    response.pop();
}
//# sourceMappingURL=main.js.map