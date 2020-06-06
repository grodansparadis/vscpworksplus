
const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app, shell,dialog } = remote;
const is = require('electron-is');

let tblMain = document.getElementById("mainTable");
let selected_name = '';


console.log(remote.getGlobal('pathHome'));
//console.log(remote.getGlobal('ppp')(10));


///////////////////////////////////////////////////////////////////////////////
// context menu
//

const menu_context = new Menu()

// Build menu one item at a time
menu_context.append(new MenuItem({
    label: 'Add...',
    click() {
        addConnection();
    }
}));
menu_context.append(new MenuItem({
    label: 'Edit...',
    click() {
        if ('' !== selected_name) {
            editConnection(selected_name);
        }
    }
}));
menu_context.append(new MenuItem({
    label: 'Delete',
    click() {
        removeConnection();
    }
}));
menu_context.append(new MenuItem({
    label: 'Clone',
    click() {
        cloneConnection();
    }
}));

menu_context.append(new MenuItem({ type: 'separator' }))

menu_context.append(new MenuItem({
    label: 'Device session',
    click() {
        openSessionWindow();
    }
}));

menu_context.append(new MenuItem({
    label: 'Device Configuration',
    click() {
        openDeviceConfigWindow();
    }
}));

menu_context.append(new MenuItem({
    label: 'Device scan',
    click() {
        openScanWindow();
    }
}));

menu_context.append(new MenuItem({
    label: 'Device firmware load',
    click() {
        openFirmwareLoadWindow();
    }
}));

menu_context.append(new MenuItem({ type: 'separator' }));

menu_context.append(new MenuItem({
    label: 'Remote variables',
    click() {
        openRemoteVariableWindow();
    }
}));

menu_context.append(new MenuItem({
    label: 'Tables',
    click() {
        openRemoteTablesWindow();
    }
}));

menu_context.append(new MenuItem({
    label: 'MDF editor',
    click() {
        openMdfEditorWindow();
    }
}));

menu_context.append(new MenuItem({ type: 'separator' }))
menu_context.append(new MenuItem({ label: 'option', type: 'checkbox', checked: true }))


///////////////////////////////////////////////////////////////////////////////
// Menu dblclick
//

const menu_dblclick = new Menu()

// Build menu one item at a time
menu_dblclick.append(new MenuItem({
    label: 'Device session',
    click() {
        openSessionWindow();
    }
}));

menu_dblclick.append(new MenuItem({
    label: 'Device Configuration',
    click() {
        openDeviceConfigWindow();
    }
}));

menu_dblclick.append(new MenuItem({
    label: 'Device scan',
    click() {
        openScanWindow();
    }
}));

menu_dblclick.append(new MenuItem({
    label: 'Device firmware load',
    click() {
        openFirmwareLoadWindow();
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
        label: 'File',
        submenu: [
            is.osx() ? { role: 'close' } : { role: 'quit' }
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
    // Device
    {
        label: 'Device',
        submenu: [
            {
                label: 'Device session',
                click() {
                    openSessionWindow();
                }
            },
            {
                label: 'Device configuration',
                click() {
                    openDeviceConfigWindow();
                }
            },
            {
                label: 'Device scan',
                click() {
                    openScanWindow();
                }
            },
            {
                label: 'Device firmware load',
                click() {
                    openFirmwareLoadWindow();
                }
            },
            { label: 'separator' },
            {
                label: 'Remote variables',
                click() {
                    openRemoteVariableWindow();
                }
            },
            {
                label: 'Tables',
                click() {
                    openRemoteTablesWindow();
                }
            },
            {
                label: 'Decision Matrix (Level II)',
                click() {
                    openDecisionMatrixEdit();
                }
            },
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

const menu_main = remote.Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu_main);

//const menu_main = new Menu()

///////////////////////////////////////////////////////////////////////////////
// openSessionWindow
//

openSessionWindow = function () {
    if ( selected_name.trim().length ) {
        ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openDeviceConfigWindow
//

openDeviceConfigWindow = function () {
    if ( selected_name.trim().length ) {
        //ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openScanWindow
//

openScanWindow = function () {
    if ( selected_name.trim().length ) {
        //ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openFirmwareLoadWindow
//

openFirmwareLoadWindow = function () {
    if ( selected_name.trim().length ) {
        //ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openRemoteVariableWindow
//

openRemoteVariableWindow = function () {
    if ( selected_name.trim().length ) {
        //ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openRemoteTablesWindow
//

openRemoteTablesWindow = function () {
    if ( selected_name.trim().length ) {
        //ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openMdfEditorWindow
//

openMdfEditorWindow = function () {
    if ( selected_name.trim().length ) {
        //ipcRenderer.send('open-new-session-window', selected_name );
    }
    else {
        dialog.showErrorBox('Unable to do requested operation', 
                            'A connection must be selected.');
    }
};

///////////////////////////////////////////////////////////////////////////////
// Page loaded (Document ready)
//

$(document).ready(function ($) {

    // Prevent default action of right click in chromium. Replace with our menu.
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        menu_context.popup(remote.getCurrentWindow())
    }, false);

    ///////////////////////////////////////////////////////////////////////////
    // AddConnections
    //
    // Add saved connections
    //

    addSavedConnections = function () {
        $("#mainTable > tbody").empty();
        let connections = ipcRenderer.sendSync('get-connection-object');
        connections.interface.forEach((item) => {
            addConnectionRow(item.name, item.type);
        });
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row
    //

    $('#mainTable > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
        console.log('Select row');
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

    $('#mainTable').dblclick(function (e) {
        menu_dblclick.popup(remote.getCurrentWindow());
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
            dialog.showErrorBox('Unable to do requested operation', 
                                'A connection must be selected.');
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
            dialog.showErrorBox('Unable to do requested operation', 
                                'A connection must be selected.');
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
            dialog.showErrorBox('Unable to do requested operation', 
                                'A connection must be selected.');
        }
    });

    ///////////////////////////////////////////////////////////////////////////////
    // context menu hide
    //

    $("#context-menu a").on("click", function () {
        $(this).parent().removeClass("show").hide();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Session
    //

    $("#btnSession").on("click", function () {
        openSessionWindow();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Configuration
    //

    $("#btnConfiguration").on("click", function () {
        openDeviceConfigWindow();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Scan
    //

    $("#btnScan").on("click", function () {
        openScanWindow();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Firmware
    //

    $("#btnFirmware").on("click", function () {
        openFirmwareLoadWindow();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Variables
    //

    $("#btnVariables").on("click", function () {
        openRemoteVariableWindow();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // btnTables
    //

    $("#btnTables").on("click", function () {
        openRemoteTablesWindow();
    });

    addSavedConnections();

}); // Windows loaded


///////////////////////////////////////////////////////////////////////////////
// addConnection
//
// Add a new connection
//
// @return answer - Structure or string containing the answer
//

async function addConnection() {

    // Let user select type of connection to add
    const result = await ipcRenderer.invoke('open-modal-dialog', 
    {
        title: "Add new connection",
        width: 800, height: 340,
        url: '../dialog_new_connection.html'
    });

    var answer;

    switch (result) {

        case "canal":
            answer = await ipcRenderer.invoke('open-modal-dialog', 
            {
                title: "Add CANAL connection",
                width: 600, height: 520,
                url: '../dialog_canal_device.html'
            });
            
            ipcRenderer.send("add-connection", answer);
            addSavedConnections();
            selected_name = answer.name;
            $('#mainTable tr').filter(function () {
                return $.trim($('td', this).eq(0).text()) == answer.name;
            }).addClass('bg-info').siblings().removeClass('bg-info');
            break;

        case "tcpip":
            answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Add tcp/ip connection",
                width: 600, height: 800,
                url: '../dialog_tcpip_device.html',
            });
                    
            ipcRenderer.send("add-connection", answer);

            addSavedConnections();

            selected_name = answer.name;
            $('#mainTable tr').filter(function () {
                return $.trim($('td', this).eq(0).text()) == answer.name;
            }).addClass('bg-info').siblings().removeClass('bg-info');
            break;

        case "websocket":
            answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Add websocket connection",
                width: 600, height: 670,
                url: '../dialog_websocket_device.html'
            });

            ipcRenderer.send("add-connection", answer);

            addSavedConnections();

            selected_name = answer.name;
            $('#mainTable tr').filter(function () {
                return $.trim($('td', this).eq(0).text()) == answer.name;
            }).addClass('bg-info').siblings().removeClass('bg-info');
            break;

        case "rest":
            answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Add REST connection",
                width: 600, height: 675,
                url: '../dialog_rest_device.html'
            });
            ipcRenderer.send("add-connection", answer);

            addSavedConnections();

            selected_name = answer.name;
            $('#mainTable tr').filter(function () {
                return $.trim($('td', this).eq(0).text()) == answer.name;
            }).addClass('bg-info').siblings().removeClass('bg-info');
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

async function editConnection(name) {

    answer = null;

    // Get connection
    const conn = await ipcRenderer.invoke('get-named-connection',name);

    //let conn = ipcRenderer.sendSync('get-named-connection', name);
    if (null === conn) {
        dialog.showErrorBox('Unable to do requested operation', 
                            'Unable to get connection "' + name + '"');
        return answer;
    }

    if ('canal' === conn.type) {
        answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 520,
                url: '../dialog_canal_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else if ('tcpip' === conn.type) {
        answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 800,
                url: '../dialog_tcpip_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else if ('websocket' === conn.type) {
        answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 750,
                url: '../dialog_websocket_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else if ('rest' === conn.type) {
        answer = await ipcRenderer.invoke("open-modal-dialog",
            {
                title: "Edit connection",
                width: 600, height: 750,
                url: '../dialog_rest_device.html',
                connection: conn
            });
        ipcRenderer.send("edit-connection", answer);
    }
    else {
        dialog.showErrorBox('Unknown connection type', 
                            'Only "canal", "tcpip", "websocket" and "rest" connections are recognized.');
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