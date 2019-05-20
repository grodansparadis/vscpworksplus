const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app } = remote;

let tblMain = document.getElementById("main-table-id");
let selected_name = '';

///////////////////////////////////////////////////////////////////////////////
// context menu
//

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
        if ('' !== selected_name) {
            editConnection(selected_name);
        }
    }
}));
menu.append(new MenuItem({
    label: 'Delete',
    click() {
        removeConnection();
    }
}));
menu.append(new MenuItem({
    label: 'Clone',
    click() {
        cloneConnection();
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

    ///////////////////////////////////////////////////////////////////////////
    // AddConnections
    //
    // Add saved connections
    //

    addSavedConnections = function () {
        $("#main-table-id > tbody").empty();
        let connections = ipcRenderer.sendSync('get-connection-object');
        connections.vscpinterface.forEach((item) => {
            addConnectionRow(item.name, item.type);
        });
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row
    //

    $('#main-table-id > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Open table row
    //

    $('#main-table-id > tbody > tr').on('dblclick', function () {
        console.log("Row double-click");
    });

    ///////////////////////////////////////////////////////////////////////////////
    // right button down
    //

    $('#main-table-id > tbody > tr').mousedown(function (e) {
        switch (event.which) {
            case 2:
                console.log('Middle mouse button is pressed');
                break;
            case 3:
                selected_name = e.currentTarget.cells[0].innerHTML;
                $(this).addClass('bg-info').siblings().removeClass('bg-info');
                break;
        }
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
        if ('' !== selected_name) {
            editConnection(selected_name);
        }
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Remove connection
    //

    $('#btnRemove').on('click', function () {
        removeConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Clone connection
    //

    $('#btnClone').on('click', function () {
        cloneConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // context menu hide
    //

    $("#context-menu a").on("click", function () {
        $(this).parent().removeClass("show").hide();
    });

    addSavedConnections();
});


///////////////////////////////////////////////////////////////////////////////
// addConnection
//
// Add a new connection
//
// @return answer - Structure or string containing the answer
//

function addConnection() {

    // Let user select type
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
            ipcRenderer.send("add-connection", answer);
            //addConnectionRow(answer.name, answer.type);
            break;

        case "tcpip":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add tcp/ip connection",
                    width: 600, height: 750,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_tcpip_device.html',
                });
            ipcRenderer.send("add-connection", answer);
            //addConnectionRow(answer.name, answer.type);
            break;

        case "websocket":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add websocket connection",
                    width: 600, height: 670,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_websocket_device.html'
                });
            ipcRenderer.send("add-connection", answer);
            addConnectionRow(answer.name, answer.type);
            break;

        case "rest":
            var answer = ipcRenderer.sendSync("open-modal-dialog",
                {
                    title: "Add REST connection",
                    width: 600, height: 675,
                    win: remote.getCurrentWindow(),
                    url: '../dialog_rest_device.html'
                });
            ipcRenderer.send("add-connection", answer);
            addConnectionRow(answer.name, answer.type);
            break;

        default:
            break;
    }

    addSavedConnections();
    selected_name = answer.name;
    $('#main-table-id tr').filter(function () {
        return $.trim($('td', this).eq(0).text()) == answer.name;
    }).addClass('bg-info').siblings().removeClass('bg-info');
}

///////////////////////////////////////////////////////////////////////////////
// editConnection
//
// Edit an existing connection
//
// @return answer - Structure or string containing the answer

function editConnection(name) {

    answer = null;

    // Get connection
    let conn = ipcRenderer.sendSync('get-named-connection', name);
    if (null === conn) {
        let options = {
            type: 'error',
            buttons: ['OK'],
            title: 'Unable to get connection "' + name + '"',
        }
        dialog.showMessageBox(remote.getCurrentWindow(), options);
        return answer;
    }

    if ('canal' === conn.type) {
        answer = ipcRenderer.sendSync("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 520,
                win: remote.getCurrentWindow(),
                url: '../dialog_canal_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else if ('tcpip' === conn.type) {
        answer = ipcRenderer.sendSync("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 750,
                win: remote.getCurrentWindow(),
                url: '../dialog_tcpip_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else if ('websocket' === conn.type) {
        answer = ipcRenderer.sendSync("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 750,
                win: remote.getCurrentWindow(),
                url: '../dialog_websocket_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else if ('rest' === conn.type) {
        answer = ipcRenderer.sendSync("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 750,
                win: remote.getCurrentWindow(),
                url: '../dialog_rest_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else {
        let options = {
            type: 'error',
            buttons: ['OK'],
            title: 'Unknown connection type',
            message: 'Only "canal", "tcpip", "websocket" and "rest" connections are recognized.'
        }
        dialog.showMessageBox(remote.getCurrentWindow(), options);
    }

    return answer;
}

///////////////////////////////////////////////////////////////////////////////
// removeConnection
//
// Remove a new connection
//
// @return answer - Structure or string containing the answer
//

function removeConnection() {
    ipcRenderer.send("remove-connection", selected_name);
    selected_name = '';
    addSavedConnections();
}


///////////////////////////////////////////////////////////////////////////////
// cloneConnection
//
// Clone a new connection
//
// @return answer - Structure or string containing the answer
//

function cloneConnection() {
    ipcRenderer.send("clone-connection", selected_name);
    addSavedConnections();
    $('#main-table-id tr').filter(function () {
        return $.trim($('td', this).eq(0).text()) == selected_name;
    }).addClass('bg-info').siblings().removeClass('bg-info');
}


// function openModalCanalDialog() {

//     let win = new remote.BrowserWindow({
//         parent: remote.getCurrentWindow(),
//         'show': false,
//         'modal': true,
//         'alwaysOnTop': true,
//         'title': options.title,
//         'autoHideMenuBar': true,
//         'webPreferences': {
//             "nodeIntegration": true,
//             "sandbox": false
//         }
//     })

//     // app.getAppPath or app.getPath(name) instead.
//     var theUrl = 'file://' + __dirname + '/../dialog_canal_device.html'
//     win.loadURL(theUrl);
// }

// Add a row to the Wizard table
var addConnectionRow = function (name, type) {

    let tableRef = tblMain.getElementsByTagName('tbody')[0];
    let row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";

    // Name
    let cellName = row.insertCell(0);
    cellName.innerHTML = name;
    cellName.style.width = "800px";

    // Type
    let cellDescription = row.insertCell(1);
    cellDescription.innerHTML = type;
    cellDescription.style.width = "20%";

    adjustListHeader();

    // Must do this here to be able to select newly added row
    $('#main-table-id > tbody > tr').unbind('click');
    $('#main-table-id > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });
}

function adjustListHeader() {
    document.getElementById('id-head-name').style.width = "800px";
    document.getElementById('id-head-type').style.width = "20%";
}


// $(document).ready(function ($) {
//     $(".table-row").click(function () {
//         console.log("new-click");
//     });
// });

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