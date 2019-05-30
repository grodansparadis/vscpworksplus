const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app, dialog } = remote;
const is = require('electron-is');
const sprintf = require('sprintf-js').sprintf;
const vscp = require('node-vscp');
const vscp_tcp_Client = require('../src/vscptcp');
const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');

let bPause = false;         // True of pause is active
let bFilter = false;        // True if filter is active
let bAutoReply = false;     // True if auto-reply is active
let bNoRxAutoScroll = false // True if auto scrolling
let eventDiff = 0;          // Used by timestamp diffs

let rxArray = [];           // Receive events shown in rx table
let rxArrayPause = [];      // Receive events go here during pause

let selectedRow = {
    vscpEvent: null
};

// RX table constants
const rxFieldDir = 0;		// Rx table filed direction
const rxFieldVscpClass = 1;	// VSCP Class
const rxFieldVscpType = 2;	// VSCP Type
const rxFieldNickname = 3;	// Nickname
const rxFieldGuid = 4;		// GUID
const rxFieldRefId = 5;		// Reference id into RX array table

// tcp/ip channel objects
let vscp_tcp_client_talker = null;
let vscp_tcp_client_listner = null;

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
    // Select table row in rx table
    //

    $('#table-rx > tbody > tr').on('click', function (e) {
        selected_name = e.currentTarget.cells[0].innerHTML;
        $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row in tx table
    //

    $('#table-tx > tbody > tr').on('click', function (e) {
        refid = parseInt(e.currentTarget.cells[rxFieldRefId].innerHTML);
        selectedRow.vscpEvent = rxArray[refid];
        console.log(selectedRow.vscpEvent);
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
    // Connection button
    //

    $('#btnConnect').on('click', function () {
        handleConnection();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Pause button
    //

    $('#btnPause').on('click', function () {
        handlePause();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Filter button
    //

    $('#btnFilter').on('click', function () {
        handleFilter();
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Auto reply button
    //

    $('#btnAutoReply').on('click', function () {
        handleAutoReply();
    });


    $("#contain-rx").mouseover(function () {
        bNoRxAutoScroll = true;
    }).mouseout(function () {
        bNoRxAutoScroll = false;
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

}); // document ready

///////////////////////////////////////////////////////////////////////////////
// hoverEnter
//

hoverEnter = function (e) {
    // Enter
    refid = parseInt(e.currentTarget.cells[5].innerHTML);
    //console.log(rxArray[refid]);
    let head = rxArray[refid].vscpHead;
    let ipv6 = vscp.isGuidIpv6(head) ? " <strong>ipv6</strong>" : "";
    let dumb = vscp.isDumbNode(head) ? " <strong>d</strong>" : "";
    let hard = vscp.isHardCoded(head) ? " <strong>hrd</strong>" : "";
    let nocrc = vscp.isNoCrc(head) ? " <strong>nc</strong>" : "";
    let tsDiff = (null != selectedRow.vscpEvent) ? (rxArray[refid].vscpTimeStamp -
        selectedRow.vscpEvent.vscpTimeStamp).toString() : '?';

    let status = " <strong>id:</strong>" + vscp.getNodeId(rxArray[refid].vscpGuid) +
        " <strong>dt:</strong>" + rxArray[refid].vscpDateTime.toISOString() +
        " <strong>ts:</strong>" + sprintf("0x%08x", rxArray[refid].vscpTimeStamp) +
        " <strong>obid:</strong>" + rxArray[refid].vscpObId +
        " <strong>head:</strong>" + rxArray[refid].vscpHead +
        " <strong>(p:</strong>" + vscp.getPriority(head) +
        " <strong>ri:</strong>" + vscp.getRollingIndex(head) +
        ipv6 + dumb + hard + nocrc + ") " +
        " <strong>&Delta;:</strong>" + tsDiff + "&micro;S";
    $("#rowstatus").html(status);
    //e.currentTarget.css("background", "yellow");
    //e.currentTarget.attr("background", "yellow");
};

///////////////////////////////////////////////////////////////////////////////
// hoverLeave
//

hoverLeave = function (e) {
    // Leave
    $(this).css("background", "");
}

tblClickHandler = function (item, e) {
    refid = parseInt(e.currentTarget.cells[rxFieldRefId].innerHTML);
    selectedRow.vscpEvent = rxArray[refid];
    $(item).addClass('bg-info').siblings().removeClass('bg-info');
}

///////////////////////////////////////////////////////////////////////////////
// addRxRow
// Add a row to the Wizard table
// e.vscpClass, e.vscpType, e.vscpGuid

let addRxRow = function (dir, e) {

    // If we are paused save received events in the pause
    // array
    if (bPause) {
        rxArrayPause.push(e);
        $("#cntPause").text(rxArrayPause.length);
        return;
    }

    let newLength = rxArray.push(e);
    $("#rxCount").text(rxArray.length);

    //let evobj = ipcRenderer.sendSync('get-vscptype-obj',
    //    e.vscpClass, e.vscpType);
    //console.log(evobj.vscpClass.token, evobj.vscpType.token);
    let evobj = {
        vscpClass: {
            name: 'aaaaa',
            token: 'yyyyyy'
        },
        vscpType: {
            name: 'bbbbb',
            token: 'zzzzzz'
        },
    };

    let tableRef = document.getElementById("table-rx").getElementsByTagName('tbody')[0];
    //let row = tableRef.insertRow(-1);
    let row = document.createElement('tr');
    row.classList.add("d-flex");
    row.style.cursor = "pointer";

    // Direction
    let cellName = row.insertCell(rxFieldDir);
    cellName.classList.add("col-1");
    cellName.classList.add("ctext");
    cellName.innerHTML = dir;

    // VSCP class
    let cellClass = row.insertCell(rxFieldVscpClass);
    cellClass.classList.add("col-3");
    cellClass.innerHTML = '<strong>' + evobj.vscpClass.token.toLowerCase() +
        '</strong><span class="text-monospace" style="color:darkgreen;">' +
        sprintf(" (0x%04x %d)", e.vscpClass, e.vscpClass) +
        '</span>';

    // VSCP type
    let cellType = row.insertCell(rxFieldVscpType);
    cellType.classList.add("col-3");
    cellType.innerHTML = '<strong>' + evobj.vscpType.name.toLowerCase() +
        '</strong><span class="text-monospace" style="color:darkgreen;">' +
        sprintf(" (0x%04x %d)", e.vscpType, e.vscpType) +
        '</span>';

    // nickname id
    let cellId = row.insertCell(rxFieldNickname);
    cellId.classList.add("col-1");
    cellId.classList.add("ctext");
    cellId.innerHTML = vscp.getNodeId(e.vscpGuid);

    // GUID
    let cellGuid = row.insertCell(rxFieldGuid);
    cellGuid.classList.add("col");
    cellGuid.innerHTML = e.vscpGuid;

    let cellTimestamp = row.insertCell(rxFieldRefId);
    cellTimestamp.classList.add("hidden");
    cellTimestamp.innerHTML = (newLength - 1).toString();

    tableRef.appendChild(row);

    $("#table-rx > tbody > tr:last").on('click', function (e) {
        tblClickHandler(this, e);
        // refid = parseInt(e.currentTarget.cells[rxFieldRefId].innerHTML);
        // selectedRow.vscpEvent = rxArray[refid];
        // $(this).addClass('bg-info').siblings().removeClass('bg-info');
    });

    ///////////////////////////////////////////////////////////////////////////////
    // Hover over table row event
    //

    //$("#table-rx > tbody > tr").not(':first').unbind('mouseenter').unbind('mouseleave')
    $("#table-rx > tbody > tr").hover((e) => hoverEnter(e),
        (e) => hoverLeave(e));

    // Make the newly added row visible but not if
    // mouse is over the table
    if (!bNoRxAutoScroll) {
        row.scrollIntoView(true);
    }
}

///////////////////////////////////////////////////////////////////////////////
// handleConnection
//

handleConnection = function () {

    console.log(typeof vscp_tcp_client_talker);

    if (null === vscp_tcp_client_talker) {
        $("#btnConnect").removeClass('badge-danger').addClass('badge-success');
        $("#btnConnect").html('<strong>Connection ON </strong><span id="rxCount" class="badge badge-secondary">0</span>');
        openConnection(connection);
    }
    else {
        $("#btnConnect").removeClass('badge-success').addClass('badge-danger');
        $("#btnConnect").html('<strong>Connection OFF </strong><span id="rxCount" class="badge badge-secondary">0</span>');
        closeConnection();
    }
};

///////////////////////////////////////////////////////////////////////////////
// handlePause
//

handlePause = function () {
    if (bPause) {
        bPause = false;
        $("body").css("cursor", "progress");
        $("#btnPause").removeClass('badge-danger').addClass('badge-success');
        //rxArrayPause.forEach((e) => {
        rxArrayPause.reverse();
        while (rxArrayPause.length) {
            e = rxArrayPause.pop();
            addRxRow('rx', e);
            $("#cntPause").text(rxArrayPause.length);
        };
        rxArrayPause = [];
        $("body").css("cursor", "default");
        $("#btnPause").removeClass('badge-danger').addClass('badge-success');
        $("#btnPause").text('Active');
    }
    else {
        bPause = true;
        $("#btnPause").removeClass('badge-success').addClass('badge-danger');
        $("#btnPause").html('<strong>Pause </strong><span id="cntPause" class="badge badge-dark">0</span>');
    }
};

///////////////////////////////////////////////////////////////////////////////
// handleFilter
//

handleFilter = function () {
    if (bFilter) {
        bFilter = false;
        $("#btnFilter").removeClass('badge-primary').addClass('badge-dark');
        $("#btnFilter").text('Filter OFF');
    }
    else {
        bFilter = true;
        $("#btnFilter").removeClass('badge-dark').addClass('badge-primary');
        $("#btnFilter").html('<strong>Filter ON </strong><span id="cntFilter" class="badge badge-dark">0</span>');
    }
};

///////////////////////////////////////////////////////////////////////////////
// handleAutoReply
//

handleAutoReply = function () {
    if (bAutoReply) {
        bAutoReply = false;
        $("#btnAutoReply").removeClass('badge-primary').addClass('badge-dark');
        $("#btnAutoReply").text('Auto-Reply OFF');
    }
    else {
        bAutoReply = true;
        $("#btnAutoReply").removeClass('badge-dark').addClass('badge-primary');
        $("#btnAutoReply").html('<strong>Auto-Reply ON </strong><span id="cntFilter" class="badge badge-dark">0</span>');
    }
};

///////////////////////////////////////////////////////////////////////////////
// openConnection
//

let openConnection = async function (connection) {

    if ('undefined' == typeof connection) {
        console.error('Connection is not defined');
        // TODO dialog
    }

    $("body").css("cursor", "progress");

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

    $("body").css("cursor", "default");

}

///////////////////////////////////////////////////////////////////////////////
// closeConnection
//

let closeConnection = function (connection) {

    $("body").css("cursor", "progress");

    if (null !== vscp_tcp_client_talker) {
        closeTakerConnection();
        console.log(vscp_tcp_client_talker);
    }

    if (null !== vscp_tcp_client_listner) {
        closeListnerConnection()
            .catch(err => {
                console.log(err);
            });
    }

    $("body").css("cursor", "default");
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
        addRxRow('rx', e);
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
