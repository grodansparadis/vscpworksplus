console.log("renderer main - start");

const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app } = remote;

let tblMain = document.getElementById("main-table-id");

const menu = new Menu()

// Build menu one item at a time, unlike
menu.append(new MenuItem({
    label: 'Add...',
    click() {
        addConnection();
    }
}));
menu.append(new MenuItem({
    label: 'Edit...',
    click() {
        openModalCanalDialog();
        //ipcRenderer.sendSync('open-canal-dialog');
    }
}));
menu.append(new MenuItem({
    label: 'Delete',
    click() {
        console.log('item 1 clicked')
    }
}));
menu.append(new MenuItem({
    label: 'Clone',
    click() {
        console.log('item 1 clicked')
    }
}));
menu.append(new MenuItem({ type: 'separator' }))
menu.append(new MenuItem({ label: 'Session', type: 'checkbox', checked: true }))
menu.append(new MenuItem({
    label: 'Configure',
    click() {
        console.log('Configure clicked')
    }
}));
menu.append(new MenuItem({
    label: 'Scan',
    click() {
        console.log('Scan clicked')
    }
}));
menu.append(new MenuItem({
    label: 'Bootloader',
    click() {
        console.log('Bootloader clicked')
    }
}));

// electron.ipcRenderer.on('reply-connection-object', (event, arg) => {
//     console.log(arg) // prints "pong"
// })

// electron.ipcRenderer.send('asynchronous-message', 'ping');

///////////////////////////////////////////////////////////////////////////////
// Document ready
//

$(document).ready(function ($) {

    // Prevent default action of right click in chromium. Replace with our menu.
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        menu.popup(remote.getCurrentWindow())
    }, false);

    let connections = ipcRenderer.sendSync('get-connection-object');
    connections.vscpinterface.forEach((item) => {
        console.log(item.name, item.type, item.description);
        addConnectionRow(item.name, item.type);
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row
    //

    $('#main-table-id > tbody > tr').on('click', function () {
        var values = [];
        var count = 0;
        console.log("Row click");

        $(this).addClass('bg-info').siblings().removeClass('bg-info');
        $(this).find("td").each(function () {
            values[count] = $(this).text();
            count++;
        });
        console.log(count, values);
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Open table row
    //

    $('#main-table-id > tbody > tr').on('dblclick', function () {
        console.log("Row double-click");
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Add new connection
    //

    $('#btnAdd').on('click', function () {
        addConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Edit connection
    //

    $('#btnEdit').on('click', function () {
        editConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Delete connection
    //

    $('#btnDelete').on('click', function () {
        deleteConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Clone connection
    //

    $('#btnClone').on('click', function () {
        cloneConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Context menu
    //

    $('#main-table-id > tbody > tr').mousedown(function (event) {
        switch (event.which) {
            case 1:
                console.log('Left mouse button is pressed');
                break;
            case 2:
                console.log('Middle mouse button is pressed');
                break;
            case 3:
                console.log('Right mouse button is pressed');
                var values = [];
                var count = 0;

                $(this).addClass('bg-info').siblings().removeClass('bg-info');
                $(this).find("td").each(function () {
                    values[count] = $(this).text();
                    count++;
                });
                break;
            default:
                console.log('Nothing');
        }
    });

    $("#context-menu a").on("click", function () {
        $(this).parent().removeClass("show").hide();
    });

});

// function openModalSelectConnectionDialog() {

//     let win = new remote.BrowserWindow({
//         parent: remote.getCurrentWindow(),
//         show: false,
//         modal: true,
//         width: 600,
//         height: 400,
//         'show': false,
//         'alwaysOnTop': true,
//         'title': "test",
//         'autoHideMenuBar': true,
//         'webPreferences': {
//             "nodeIntegration": true,
//             "sandbox": false
//         }
//     })

//     win.on('closed', () => {
//         win = null
//         console.log('close');
//         //callback(promptAnswer);
//     })

//     // app.getAppPath or app.getPath(name) instead.
//     console.log(__dirname);
//     var theUrl = 'file://' + __dirname + '/../dialog_new_connection.html'
//     console.log('url', theUrl);

//     win.loadURL(theUrl);
//     win.show();
// }

///////////////////////////////////////////////////////////////////////////////
// addConnection
//
// Add a new connection
//
// @return answer - Structure or string containing the answer
//

function addConnection() {
    var answer = ipcRenderer.sendSync("open-modal-dialog",
        {
            title: "Add new connection",
            width: 600, height: 340,
            win: remote.getCurrentWindow(),
            url: '../dialog_new_connection.html'
        });

    switch (answer) {
        case "canal":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add CANAL connection",
                    width: 600, height: 520,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_canal_device.html'
                });
            break;

        case "tcpip":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add tcp/ip connection",
                    width: 600, height: 670,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_tcpip_device.html'
                });
            break;

        case "websocket":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add websocket connection",
                    width: 600, height: 670,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_websocket_device.html'
                });
            break;

        case "rest":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add REST connection",
                    width: 600, height: 675,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_rest_device.html'
                });
            break;

        default:
            break;
    }
}

///////////////////////////////////////////////////////////////////////////////
// editConnection
//
// Edit an existing connection
//
// @return answer - Structure or string containing the answer

function editConnection() {
    var answer = ipcRenderer.sendSync("open-modal-dialog",
        {
            title: "Edit connection",
            width: 600, height: 340,
            win: remote.getCurrentWindow(),
            url: '../dialog_new_connection.html'
        });
    return answer;
}

function openModalCanalDialog() {

    let win = new remote.BrowserWindow({
        parent: remote.getCurrentWindow(),
        'show': false,
        'modal': true,
        'alwaysOnTop': true,
        'title': options.title,
        'autoHideMenuBar': true,
        'webPreferences': {
            "nodeIntegration": true,
            "sandbox": false
        }
    })

    // app.getAppPath or app.getPath(name) instead.
    console.log(__dirname);
    var theUrl = 'file://' + __dirname + '/../dialog_canal_device.html'
    console.log('url', theUrl);

    win.loadURL(theUrl);
}

// Add a row to the Wizard table
var addConnectionRow = function (name, type) {

    let tableRef = tblMain.getElementsByTagName('tbody')[0];
    let row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";

    // Name
    let cellName = row.insertCell(0);
    cellName.innerHTML = name;
    cellName.style.width = "800px";
    //cellName.classList.add("ctext");

    // Type
    let cellDescription = row.insertCell(1);
    cellDescription.innerHTML = type;
    cellDescription.style.width = "20%";
    //cellDescription.classList.add("ctext");

    adjustListHeader();
}

function adjustListHeader() {
    document.getElementById('id-head-name').style.width = "800px";
    document.getElementById('id-head-type').style.width = "20%";
}


$(document).ready(function ($) {
    $(".table-row").click(function () {
        console.log("new-click");
    });
});

$(function () {
    $(".nav-link").on("click", "li", function (event) {
        console.log("You clicked the drop downs", event)
    })
});

$('#myTab a').click(function (e) {
    e.preventDefault();
    ($(this)).tab('show');
    console.log("tab-click");
});

console.log("renderer main - end");