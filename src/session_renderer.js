const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app, dialog } = remote;
const is = require('electron-is');
const vscp = require('./vscp');
const vscp_tcp_Client = require('../src/vscptcp');
const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');

let session_win_obj = {};   // Our windows object
let connection = {};        // Connection we should work on

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
// Window menu
//

const template = [
    // { role: 'appMenu' }
    ...(is.osx() ? [{
        label: app.getName(),
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    }] : []),
    // { role: 'fileMenu' }
    {
        label: 'Session',
        submenu: [
            {
                label: 'Close',
                click() {
                    closeSession();
                }
            }

        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(is.osx() ? [
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Speech',
                    submenu: [
                        { role: 'startspeaking' },
                        { role: 'stopspeaking' }
                    ]
                }
            ] : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
        ]
    },
    {
        label: 'Tools',
        submenu: [
            {
                label: 'MDF editor',
                click() {
                    openMdfEditorWindow();
                }
            },
            { type: 'separator' },
            {
                label: 'Add connection',
                click() {
                    addConnection();
                }
            },
            {
                label: 'Edit connection',
                click() {
                    editConnection();
                }
            },
            {
                label: 'Remove connection',
                click() {
                    removeConnection();
                }
            },
            {
                label: 'Clone connection',
                click() {
                    cloneConnection();
                }
            },
            { type: 'separator' },

        ]
    },
    {
        label: 'Settings',
        submenu: [
            {
                label: 'General Settings',
                click() {
                    ;
                }
            },
            {
                label: 'Load class/type definitions',
                click() {
                    ;
                }
            },
            {
                label: "Handle known GUID's",
                click() {
                    ;
                }
            },
        ]
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggledevtools' },
            { type: 'separator' },
            { role: 'resetzoom' },
            { role: 'zoomin' },
            { role: 'zoomout' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            ...(is.osx() ? [
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ] : [
                    { role: 'close' }
                ])
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'VSCP site',
                click() { remote.shell.openExternal('https://vscp.org') }
            },
            {
                label: 'VSCP Works documentation',
                click() { remote.shell.openExternal('https://vscp.org') }
            },
            {
                label: 'VSCP documentation',
                click() { remote.shell.openExternal('https://www.vscp.org/#documentation') }
            }
            ,
            {
                label: 'About',
                click() { remote.shell.openExternal('https://www.vscp.org/#sponsors') }
            }
        ]
    }
]

const menu_session = remote.Menu.buildFromTemplate(template);

///////////////////////////////////////////////////////////////////////////////
// getVscpClassObj
//
// 'undefined' is returned if VSCP class is not found
//

getVscpClassObj = function (vscpclass) {
    // Find VSCP class
    return remote.getGlobal('classDefs').find((element) => element.class === vscpclass);
};

///////////////////////////////////////////////////////////////////////////////
// getVscpTypeObj
//
// 'undefined' is returned if VSCP class and/or VSCP type is not found
//

getVscpTypeObj = function (vscpclass) {
    // Find VSCP class
    let foundClass = remote.getGlobal('classDefs').find((element) =>
        element.class === vscpclass);

    // Find type in class
    return foundClass.types.find((element) => element.type === vscptype);
};

///////////////////////////////////////////////////////////////////////////////
// closeSession
//

closeSession = function () {
    remote.getCurrentWindow().close();
}

///////////////////////////////////////////////////////////////////////////////
// Document ready
//

$(document).ready(function ($) {

    remote.getCurrentWindow().setMenu(menu_session);

    // Prevent default action of right click in chromium. Replace with our menu.
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        menu.popup(remote.getCurrentWindow())
    }, false);

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row
    //

    $('#table-rx > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row
    //

    $('#table-tx > tbody > tr').on('click', function (e) {
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

    // Get data for session connection
    session_win_obj = ipcRenderer.sendSync('get-named-child-window-record',
        remote.getCurrentWindow().id);

    // Get connection
    if (null !== session_win_obj) {
        connection = ipcRenderer.sendSync('get-named-connection',
            session_win_obj.connection_name);
        if (null === connection) {
            let options = {
                type: 'error',
                buttons: ['OK'],
                title: 'System does not recognized this connection. Session window will  be closed',
            }
            dialog.showMessageBox(remote.getCurrentWindow(), options);
            remote.getCurrentWindow().close();
        }
    }
    else {
        let options = {
            type: 'error',
            buttons: ['OK'],
            title: 'System does not recognized this session window. Session window will be closed',
        }
        dialog.showMessageBox(remote.getCurrentWindow(), options);
        remote.getCurrentWindow().close();
    }

    openConnection(connection);

});

///////////////////////////////////////////////////////////////////////////////
// addRxRow
// Add a row to the Wizard table
//

let addRxRow = function (name, type) {

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

///////////////////////////////////////////////////////////////////////////////
// openConnection
//

let openConnection = async function (connection) {

    let host = 'localhost';
    let port = 9598;

    let sep = connection.host.split(':');
    if ( sep.length > 1 ) {
        host = sep[0];
        port = parseInt(sep[1]);
    }
    else {
        host = connection.host;
    }

    console.log('Open Connection');

    let vscp_tcp_client = new vscp_tcp_Client();

    vscp_tcp_client.addEventListener((e) => {
        console.log("Event received");
        //console.log(e,e.vscpClass,e.vscpType);
        let evobj = ipcRenderer.sendSync('get-vscptype-obj',
        e.vscpClass,e.vscpType);
        console.log(evobj.vscpClass.name,evobj.vscpType.name);
    });

    console.log(connection,host, port);

    const value1 = await vscp_tcp_client.connect(
        {
            host: host,
            port: port,
            timeout: 10000,
            onSuccess: null
        });
    await vscp_tcp_client.sendCommand(
        {
            command: "noop"
        });
    const ttt = await vscp_tcp_client.sendCommand(
        {
            command: "user",
            argument: connection.username
        });
    console.log(ttt);
    await vscp_tcp_client.sendCommand(
        {
            command: "pass",
            argument: connection.password
        });
    await vscp_tcp_client.startRcvLoop();

}

///////////////////////////////////////////////////////////////////////////////
// closeConnection
//

let closeConnection = function (connection) {
    console.log('Close Connection');
}