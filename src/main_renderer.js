const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app } = remote;

let tblMain = document.getElementById("mainTable");
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
        $("#mainTable > tbody").empty();
        let connections = ipcRenderer.sendSync('get-connection-object');
        connections.vscpinterface.forEach((item) => {
            addConnectionRow(item.name, item.type);
        });
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row
    //

    $('#mainTable > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Open table row
    //

    $('#mainTable > tbody > tr').on('dblclick', function () {
        console.log("Row double-click");
    });

    ///////////////////////////////////////////////////////////////////////////////
    // right button down
    //

    $('#mainTable > tbody > tr').mousedown(function (e) {
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
        else {
            let options = {
                type: 'error',
                buttons: ['OK'],
                title: 'No connection selected,',
            }
            dialog.showMessageBox(remote.getCurrentWindow(), options);
        }
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Remove connection
    //

    $('#btnRemove').on('click', function () {
        if ('' !== selected_name) {
            removeConnection();
        }
        else {
            let options = {
                type: 'error',
                buttons: ['OK'],
                title: 'No connection selected,',
            }
            dialog.showMessageBox(remote.getCurrentWindow(), options);
        }
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Clone connection
    //

    $('#btnClone').on('click', function () {
        if ('' !== selected_name) {
            cloneConnection();
        }
        else {
            let options = {
                type: 'error',
                buttons: ['OK'],
                title: 'No connection selected,',
            }
            dialog.showMessageBox(remote.getCurrentWindow(), options);
        }
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
            break;

        default:
            break;
    }

    addSavedConnections();
    selected_name = answer.name;
    $('#mainTable tr').filter(function () {
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
    $('#mainTable tr').filter(function () {
        return $.trim($('td', this).eq(0).text()) == selected_name;
    }).addClass('bg-info').siblings().removeClass('bg-info');
}

///////////////////////////////////////////////////////////////////////////////
// addConnectionRow
//
// Add a row to the Wizard table
//

var addConnectionRow = function (name, type) {

    let tableRef = tblMain.getElementsByTagName('tbody')[0];
    let row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";
    row.setAttribute('class', "d-flex");

    // Name
    let cellName = row.insertCell(0);
    cellName.innerHTML = name;
    cellName.setAttribute('class', "col-8");

    // Type
    let cellDescription = row.insertCell(1);
    cellDescription.innerHTML = type;
    cellDescription.setAttribute('class', "col-4");

    // Must do this here to be able to select newly added row
    $('#mainTable > tbody > tr').unbind('click');
    $('#mainTable > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });
}


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