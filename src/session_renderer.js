const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app, dialog } = remote;
const is = require('electron-is');
const sprintf = require('sprintf-js').sprintf;
const vscp = require('node-vscp');
const vscp_tcp_Client = require('../src/vscptcp');
const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');

// tcp/ip channel objects
let vscp_tcp_client_talker;
let vscp_tcp_client_listner;

let session_win_obj = {};   // Our windows object
let connection = {};        // Connection we should work on
let activeConnection = {
    talker: {},
    listner: {}
}


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
// e.vscpClass, e.vscpType, e.vscpGuid

let addRxRow = function (dir, e) {

    let evobj = ipcRenderer.sendSync('get-vscptype-obj',
    e.vscpClass, e.vscpType);
    //console.log(evobj.vscpClass.token, evobj.vscpType.token);

    let tableRef = document.getElementById("table-rx").getElementsByTagName('tbody')[0];
    let row = tableRef.insertRow(-1);
    row.classList.add("d-flex");
    row.style.cursor = "pointer";

    // Direction
    let cellName = row.insertCell(0);
    cellName.classList.add("col-1");
    cellName.classList.add("ctext");
    cellName.innerHTML = dir;

    // VSCP class
    let cellClass = row.insertCell(1);
    cellClass.classList.add("col-3");
    cellClass.innerHTML = '<strong>' + evobj.vscpClass.token.toLowerCase() +
        '</strong><span class="text-monospace" style="color:darkgreen;">' +
        sprintf(" (0x%04x %d)", e.vscpClass, e.vscpClass) +
        '</span>';

    // VSCP type
    let cellType = row.insertCell(2);
    cellType.classList.add("col-3");
    cellType.innerHTML = '<strong>' + evobj.vscpType.name.toLowerCase() +
        '</strong><span class="text-monospace" style="color:darkgreen;">' +
        sprintf(" (0x%04x %d)", e.vscpType, e.vscpType) +
        '</span>';

    // nickname id
    let cellId = row.insertCell(3);
    cellId.classList.add("col-1");
    cellId.classList.add("ctext");
    cellId.innerHTML = vscp.getNodeId(e.vscpGuid);

    // GUID
    let cellGuid = row.insertCell(4);
    cellGuid.classList.add("col");
    cellGuid.innerHTML = e.vscpGuid;

    let cellTimestamp = row.insertCell(5);
    cellTimestamp.classList.add("hidden");
    cellTimestamp.innerHTML = "4134";

    // Must do this here to be able to select newly added row
    $('#table-rx > tbody > tr').unbind('click');
    $('#table-rx > tbody > tr').on('click', function (e) {
         selected_name = e.currentTarget.cells[0].innerHTML;
         $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });
}

///////////////////////////////////////////////////////////////////////////////
// openConnection
//

let openConnection = async function (connection) {

    activeConnection.listner.read_wcyd = connection.wcyd;

    if (connection.wcyd[7] & vscp.hostCapabilities.TWO_CONNECTIONS) {
        activeConnection.talker.twoConnectionsAllowed = true;
    }
    else {
        activeConnection.talker.twoConnectionsAllowed = false;
    }

    await openTcpipTalkerConnection(connection);

    // Get capabilities
    //   If more than one channel can be open we open
    //   a separate listening channel
    let wcyd_fetched = await vscp_tcp_client_talker.getWhatCanYouDo()
        .catch(err => {
            console.log('No wcyd command', err);
        });

    if ('undefined' !== typeof wcyd_fetched) {
        activeConnection.talker.read_wcyd = wcyd_fetched;
        if (wcyd[7] & vscp.hostCapabilities.TWO_CONNECTIONS) {
            activeConnection.talker.twoConnectionsAllowed = true;
        }
    }

    if (activeConnection.talker.twoConnectionsAllowed) {
        console.log('Yes, can handle two or more connections');
        openTcpipListnerConnection(connection, activeConnection.talker.chid);
    }

}

///////////////////////////////////////////////////////////////////////////////
// closeConnection
//

let closeConnection = function (connection) {
    console.log('Close Connection');
}

///////////////////////////////////////////////////////////////////////////////
// openTcpipTalkerConnection
//
// The 'talker' connection is used to send events and other commands. On
// a one channel device it is used also to pull for incoming events
//

let openTcpipTalkerConnection = async function (connection) {

    let rv = false;

    console.log('Open Talker Connection');

    // Defaults
    let host = 'localhost';
    let port = 9598;

    // Separate from 'host:port' form
    let sep = connection.host.split(':');
    if (sep.length > 1) {
        host = sep[0];
        port = parseInt(sep[1]);
    }
    else {
        host = connection.host;
    }

    vscp_tcp_client_talker = new vscp_tcp_Client();

    const value1 = await vscp_tcp_client_talker.connect(
        {
            host: host,
            port: port,
            timeout: connection.connTimeout,
            onSuccess: null
        });

    await vscp_tcp_client_talker.user(
        {
            username: connection.username
        });

    await vscp_tcp_client_talker.password(
        {
            password: connection.password
        });

    // If the connection have an assigned GUID set it
    let guid = vscp.strToGuid(connection.guid);
    if (!isGuidZero(guid)) {
        await setGUID(
            {
                guid: connection.guid
            });
    }

    // Get host version
    activeConnection.talker.hostVersion = await vscp_tcp_client_talker.getRemoteVersion();
    console.log(activeConnection.talker.hostVersion);

    // Get the channel id
    activeConnection.talker.channelId = await vscp_tcp_client_talker.getChannelID();

    // Get the channel guid
    activeConnection.talker.channelGuid = await vscp_tcp_client_talker.getGUID();

    return rv;
}

///////////////////////////////////////////////////////////////////////////////
// isGuidZero
//

let isGuidZero = function (guid) {

    if ("undefined" === typeof guid) {
        return false;
    }

    if ("string" === typeof guid) {
        guid = vscp.strToGuid(guid);
    }

    for (let i = 0; i < 16; i++) {
        if (guid[i]) return false;
    }

    return true;
}

///////////////////////////////////////////////////////////////////////////////
// openTcpipListnerConnection
//
// The 'listner' connection is used to receive events from a remote host. This
// is only possible if the remote can have more than one channel open at once.
// This is checked with the 'wcyd' command.
//

let openTcpipListnerConnection = async function (connection, chid) {

    console.log('Open Listner Connection');

    // Defaults
    let host = 'localhost';
    let port = 9598;

    // Separate from 'host:port' form
    let sep = connection.host.split(':');
    if (sep.length > 1) {
        host = sep[0];
        port = parseInt(sep[1]);
    }
    else {
        host = connection.host;
    }

    vscp_tcp_client_listner = new vscp_tcp_Client();

    // Add event handler for received events
    vscp_tcp_client_listner.addEventListener((e) => {
        let evobj = ipcRenderer.sendSync('get-vscptype-obj',
             e.vscpClass, e.vscpType);
        //console.log(e, evobj.vscpClass.token, evobj.vscpType.token);
        addRxRow('rx', e );
    });

    const value1 = await vscp_tcp_client_listner.connect(
        {
            host: host,
            port: port,
            timeout: connection.connTimeout,
            onSuccess: null
        });

    await vscp_tcp_client_listner.user(
        {
            username: connection.username
        });

    await vscp_tcp_client_listner.password(
        {
            password: connection.password
        });

    // Get the channel id
    activeConnection.listner.channelId = await vscp_tcp_client_listner.getChannelID();

    // Get the channel guid
    activeConnection.listner.channelGuid = await vscp_tcp_client_listner.getGUID();

    // Set filter/mask

    await vscp_tcp_client_listner.startRcvLoop();
}

///////////////////////////////////////////////////////////////////////////////
// closeTalkerConnection
//

let closeTakerConnection = async function (connection) {

    console.log('Close Taker Connection');

    // Disconnect connection
    await vscp_tcp_client_talker.disconnect();

    // Throw to the garbage collector
    vscp_tcp_client_talker = null;
}

///////////////////////////////////////////////////////////////////////////////
// closeListnerConnection
//

let closeListnerConnection = async function (connection) {

    console.log('Close ListnerConnection');

    // Terminate receive loop
    await vscp_tcp_client_listner.stopRcvLoop();

    // Disconnect connection
    await vscp_tcp_client_listner.disconnect();

    // Throw to the garbage collector
    vscp_tcp_client_listner = null;
}
