

const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, app, dialog } = remote;
const fs = require('fs');
const is = require('electron-is');
const sprintf = require('sprintf-js').sprintf;
const vscp = require('node-vscp');
const vscp_tcp_client = require('node-vscp-tcp');
const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');
console.log("Loaded");

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
let conn = {};              // Connection we should work on
let activeConnection = {
    talker: {},
    listner: {}
}

const homeFolder = ipcRenderer.sendSync('get-home-folder');

///////////////////////////////////////////////////////////////////////////////
// context RX menu
//

const crxmenu = new Menu()

// Build menu one item at a time, unlike
crxmenu.append(new MenuItem({
    label: 'Copy event to clipboard',
    click() {
        copyRxEvent();
    }
}));
crxmenu.append(new MenuItem({
    label: 'Clear all receive events',
    click() {
        clearRxTable();
    }
}));
crxmenu.append(new MenuItem({
    label: 'Load events from file...',
    click() {
        loadRxRows();
    }
}));
crxmenu.append(new MenuItem({
    label: 'Save events to file...',
    click() {
        saveRxRows();
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
                click() { remote.shell.openExternal('https://docs.vscp.org/vscpworks/latest') }
            },
            {
                label: 'VSCP documentation',
                click() { remote.shell.openExternal('https://docs.vscp.org') }
            }
            ,
            {
                label: 'About',
                click() { remote.shell.openExternal('https://www.vscp.org') }
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
    // window.addEventListener('contextmenu', (e) => {
    //     e.preventDefault();
    //     console.log("id",e,$(e.target), e.target.getAttribute('id') );
    //     crxmenu.popup({
    //         window: remote.getCurrentWindow(),
    //     })
    // }, false);

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row in rx table
    //

    // $('#table-rx > tbody > tr').on('click', function (e) {
    //     selected_name = e.currentTarget.cells[0].innerHTML;
    //     $(this).addClass('bg-info').siblings().removeClass('bg-info');
    // });

    ///////////////////////////////////////////////////////////////////////////////
    // Select table row in tx table
    //

    // $('#table-tx > tbody > tr').on('click', function (e) {
    //     refid = parseInt(e.currentTarget.cells[rxFieldRefId].innerHTML);
    //     selectedRow.vscpEvent = rxArray[refid];
    //     console.log(selectedRow.vscpEvent);
    //     $(this).addClass('bg-info').siblings().removeClass('bg-info');
    // });


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
    console.log("id=",remote.getCurrentWindow().id);
    const id = remote.getCurrentWindow().id;
    ipcRenderer.invoke('get-named-child-window-record',
                        id).then( session_win_obj => { 
        
        console.log("Session obj = ",session_win_obj);                            
        const obj = JSON.parse(session_win_obj);                    
        // Get connection
        if (null !== obj) {
            console.log("Connection=",obj.connection_name);
            ipcRenderer.invoke('get-named-connection',
                                obj.connection_name).then( conn => {
                if (null === conn) {
                    dialog.showErrorBox("Error", 
                        'System does not recognized this connection. Session window will be closed');
                    remote.getCurrentWindow().close();
                }
                console.log("conn=",conn);

                // Open the session connection
                openConnection(conn);
            });
            
        }    
        else {
            dialog.showErrorBox("Error",
                'System does not recognized this session window. Session window will be closed');
            remote.getCurrentWindow().close();
        }
    
    });
    
}); // document ready

///////////////////////////////////////////////////////////////////////////////
// copyRxEvent
//

copyRxEvent = function () {

}

///////////////////////////////////////////////////////////////////////////////
// clearRxTable
//

clearRxTable = function () {
    $("#table-rx tr").remove();
    rxArray = [];
    $("#rxCount").text(rxArray.length);
}

///////////////////////////////////////////////////////////////////////////////
// loadRxRows
//

loadRxRows = function () {

    dialog.showOpenDialog(remote.getCurrentWindow(),
        {
            title: "Select file to load events from",
            properties: ['openFile', 'showHiddenFiles'],
            defaultPath: homeFolder,
            filters: [
                { name: 'VSCP events', extensions: ['events', 'json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        },
        (fileName) => {

            if (fileName === undefined) {
                console.log("What!");
                return;
            }

            try {
                newEvents = [];
                if (fs.existsSync(fileName[0])) {
                    let rawdata = fs.readFileSync(fileName[0]);
                    newEvents = JSON.parse(rawdata);
                    newEvents.forEach((item) => {
                        addRxRow('load', item);
                    });
                }
                else {
                    console.log("File does not appear to exist." + fileName[0]);
                }
            }
            catch (err) {
                console.error("Failed to fetch saved events from " + fileName);
                console.error(err);
            }

        });
}

///////////////////////////////////////////////////////////////////////////////
// saveRxRows
//

saveRxRows = function () {

    dialog.showSaveDialog(remote.getCurrentWindow(),
        {
            title: "Select file to save events to",
            defaultPath: homeFolder,
            filters: [
                { name: 'VSCP events', extensions: ['events', 'json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        }, (fileName) => {

            if (fileName === undefined) {
                return;
            }

            fs.open(fileName, 'w', (err, fd) => {

                if (err) {

                    if (err.code === 'EEXIST') {
                        console.error('file already exists');
                        return;
                    }

                    throw err;

                }

                fs.writeSync(fd, "[");
                for (let i = 0; i < rxArray.length; i++) {
                    //console.log(rxArray[i],JSON.stringify(rxArray[i]));
                    fs.writeSync(fd, JSON.stringify(rxArray[i]));
                    if (i < (rxArray.length - 1)) fs.writeSync(fd, ",");
                };
                fs.writeSync(fd, "]");

            });

        });
}

///////////////////////////////////////////////////////////////////////////////
// hoverEnter
//

hoverEnter = function (item, e) {
    // Enter
    refid = parseInt(e.currentTarget.cells[5].innerHTML);
    let dt = new Date(rxArray[refid].vscpDateTime);
    let head = rxArray[refid].vscpHead;
    let ipv6 = vscp.isIPV6Addr(head) ? " <strong>ipv6</strong>" : "";
    let dumb = vscp.isDumbNode(head) ? " <strong>d</strong>" : "";
    let hard = vscp.isHardCodedAddr(head) ? " <strong>hrd</strong>" : "";
    let nocrc = vscp.isDoNotCalcCRC(head) ? " <strong>nc</strong>" : "";
    let tsDiff = (null != selectedRow.vscpEvent) ? (rxArray[refid].vscpTimeStamp -
        selectedRow.vscpEvent.vscpTimeStamp).toString() : '?';
    let status = " <strong>id:</strong>" + vscp.getNodeId(rxArray[refid].vscpGuid) +
        " <strong>dt:</strong>" + dt.toISOString() +
        " <strong>ts:</strong>" + sprintf("0x%08x", rxArray[refid].vscpTimeStamp) +
        " <strong>obid:</strong>" + rxArray[refid].vscpObId +
        " <strong>head:</strong>" + rxArray[refid].vscpHead +
        " <strong>(p:</strong>" + vscp.getPriority(head) +
        " <strong>ri:</strong>" + vscp.getRollingIndex(head) +
        ipv6 + dumb + hard + nocrc + ") " +
        " <strong>&Delta;:</strong>" + tsDiff + "&micro;S";
    $("#rowstatus").html(status);
    $(item).css("background", "yellow");
};

///////////////////////////////////////////////////////////////////////////////
// hoverLeave
//

hoverLeave = function (item, e) {
    // Leave
    $(item).css("background", "");
}

///////////////////////////////////////////////////////////////////////////////
// rxtblClickHandler
//

rxtblClickHandler = function (item, e) {

    refid = parseInt(e.currentTarget.cells[rxFieldRefId].innerHTML);
    selectedRow.vscpEvent = rxArray[refid];
    $(item).addClass('bg-info').siblings().removeClass('bg-info');

    // Fill in data in the info window
    let info = '<div class="ctext"><strong>';
    if ('rx' === rxArray[refid].dir) {
        info += 'Received Event';
    }
    else if ('tx' === rxArray[refid].dir) {
        info += 'Transmitted Event';
    }
    else if ('load' === rxArray[refid].dir) {
        info += 'Loaded Event';
    }
    else {
        info += 'Unknown Event';
    }
    info += '</strong></div>';
    info += '<div><strong>Time: </strong>';
    info += '<span class="text-monospace" style="color:darkgreen;">';
    info += rxArray[refid].vscpDateTime.toISOString();
    info += '</span>';
    info += '</div>';
    info += '<p class="text-monospace">';
    info += '<div><strong>Class: </strong>';
    info += '<kbd>' + rxArray[refid].evobj.vscpClass.name.toLowerCase() + '</kbd>';
    info += '<div class="text-monospace" style="color:darkgreen;">';
    info += sprintf(" (0x%04x %d)", rxArray[refid].vscpClass, rxArray[refid].vscpClass);
    info += '</div>';
    info += '</div>';
    info += '<div><strong>Type: </strong><kbd>';
    info += rxArray[refid].evobj.vscpType.name.toLowerCase();
    info += '</kbd>';
    info += '<div class="text-monospace" style="color:darkgreen;">'
    info += sprintf(" (0x%04x %d)", rxArray[refid].vscpType, rxArray[refid].vscpType);
    info += '</div>';
    info += '</div>';
    info += '</p>';
    info += '<p>';
    info += '<div><strong>Data count: </strong>';
    info += '<span class="text-monospace" style="color:darkgreen;">';
    info += rxArray[refid].vscpData.length;
    info += '</span></div>';
    info += '<div class="text-monospace" style="color:darkgreen;">';
    let pos = 0;

    while (pos < rxArray[refid].vscpData.length) {
        let row = '<div>';
        for (let i = 0; i < 8; i++) {
            row += sprintf("0x%02x", rxArray[refid].vscpData[pos++]);
            if (i < 7) {
                row += ',';
            }
            if (pos > (rxArray[refid].vscpData.length - 1)) break;
        }
        info += row;
    }

    info += '</div>';

    // If measurement
    let val = 0;
    let sensoIndex = -1;
    let unitIdx = -1;
    let unit = -1;
    if (vscp.isMeasurement(rxArray[refid].vscpClass)) {
        info += '<p>';
        info += '<div><strong>Measurement: </strong></div>';
        // Classes with data coding byte
        if ((vscp_class.VSCP_CLASS1_MEASUREMENT === rxArray[refid].vscpClass) ||
            (vscp_class.VSCP_CLASS1_DATA === rxArray[refid].vscpClass)) {
            val = vscp.decodeClass10(rxArray[refid].vscpData);
            sensorIndex = vscp.getSensorIndexFromDataCoding(rxArray[refid].vscpData[0]);
            unitIdx = vscp.getUnitFromDataCoding(rxArray[refid].vscpData[0]);
            unit = vscp.constants.units[rxArray[refid].vscpType][unitId];
        }
        // Floating point
        else if (vscp_class.VSCP_CLASS1_MEASUREMENT64 === rxArray[refid].vscpClass) {
            val = vscp.decodeClass60Number(rxArray[refid].vscpData);
            unitIdx = vscp.getUnitFromDataCoding(rxArray[refid].vscpData[0]);
            unit = vscp.constants.units[rxArray[refid].vscpType][unitId];
        }
        // Measurement with zone information
        else if ((vscp_class.VSCP_CLASS1_MEASUREZONE === rxArray[refid].vscpClass) ||
            (vscp_class.VSCP_CLASS1_SETVALUEZONE === rxArray[refid].vscpClass)) {
        }
        info += '</p>';
    }

    info += '<p>';
    info += '<div><strong>From GUID: </strong></div>';
    info += '<div class="text-monospace" style="color:darkgreen;">';
    info += rxArray[refid].vscpGuid
    info += '</div>';
    info += '</p>';
    info += '<p>';
    info += '<div><strong>Head: </strong>';
    info += '<span class="text-monospace" style="color:darkgreen;">';
    info += sprintf("0x%04x %d", rxArray[refid].vscpHead, rxArray[refid].vscpHead);
    info += '</span></div>';
    info += '<div><strong>Timestamp: </strong>';
    info += '<span class="text-monospace" style="color:darkgreen;">';
    info += sprintf("0x%08x", rxArray[refid].vscpTimeStamp);
    info += '</span></div>';
    info += '</p>';

    /*
        <div><strong>Unit: </strong>
            <span class="text-monospace" style="color:darkgreen;">1</span></div>
        <div><strong>Sensor: </strong>
            <span class="text-monospace" style="color:darkgreen;">0</span></div>
        <div><strong>Coding: </strong>
            <span class="text-monospace" style="color:darkgreen;">Normalized integer</span></div>
        <div><strong>Value: </strong>
            <span class="text-monospace" style="color:darkgreen;">-68.580000 C</span>
        </div>
    </p>
    <p>
        <div><strong>From GUID: </strong></div>
        <div class="text-monospace" style="color:darkgreen;">00:00:00:00 00:00:00:00 00:00:00:00
            00:01:00:03</div>
    </p>
    <p>
        <div><strong>Head: </strong>
            <span class="text-monospace" style="color:darkgreen;">60</span></div>
        <div><strong>Timestamp: </strong>
            <span class="text-monospace" style="color:darkgreen;">AAE77267</span></div>
    </p>
    */

    $(infoarea).html(info);
}

///////////////////////////////////////////////////////////////////////////////
// addRxRow
// Add a row to the Wizard table
//

let addRxRow = function (dir, e) {

    // If we are paused save received events in the pause array
    if (bPause) {
        rxArrayPause.push(e);
        $("#cntPause").text(rxArrayPause.length);
        return;
    }

    e.dir = dir;        // Add direction to event object

    let evobj = ipcRenderer.sendSync('get-vscptype-obj',
        e.vscpClass, e.vscpType);
    e.evobj = evobj;    // Add info to event object
    //console.log(evobj.vscpClass.token, evobj.vscpType.token);
    // let evobj = {
    //     vscpClass: {
    //         name: 'aaaaa',
    //         token: 'yyyyyy'
    //     },
    //     vscpType: {
    //         name: 'bbbbb',
    //         token: 'zzzzzz'
    //     },
    // };

    let newLength = rxArray.push(e);
    $("#rxCount").text(rxArray.length);

    let tableRef = document.getElementById("table-rx").getElementsByTagName('tbody')[0];
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

    // Add row to table
    tableRef.appendChild(row);

    // Add click event to row
    row.onclick = function (e) {
        rxtblClickHandler(this, e);
    };

    // Add hover
    row.onmouseenter = function (e) {
        hoverEnter(this, e);
    }

    row.onmouseleave = function (e) {
        hoverLeave(this, e);
    }

    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        console.log("id", e, $(e.target), e.target.getAttribute('id'));
        crxmenu.popup({
            window: remote.getCurrentWindow(),
        })
    }, false);

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
        openConnection(conn);
    }
    else {
        $("#btnConnect").removeClass('badge-success').addClass('badge-danger');
        $("#btnConnect").html('<strong>Connection OFF </strong><span id="rxCount" class="badge badge-secondary">0</span>');
        closeConnection();
    }

    $("#rxCount").text(rxArray.length);
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

let openConnection = async function (conn) {

    console.log("conn=",conn);

    if ('undefined' == typeof conn) {
        dialog.showErrorBox('Error', 
                            'Remote connection is not defined');
        return;                            
    }

    $("body").css("cursor", "progress");

    activeConnection.listner.read_wcyd = conn.wcyd;
    console.log(conn,conn.wcyd);

    if (conn.wcyd[7] & vscp.hostCapability.TWO_CONNECTIONS) {
        activeConnection.talker.twoConnectionsAllowed = true;
    }
    else {
        activeConnection.talker.twoConnectionsAllowed = true;
    }

    await openTcpipTalkerConnection(conn);

    // Get capabilities
    //   If more than one channel can be open we open
    //   a separate listening channel
    let wcyd_fetched = await vscp_tcp_client_talker.getWhatCanYouDo()
        .catch(err => {
            console.log('No wcyd command', err);
        });

    if ('undefined' !== typeof wcyd_fetched) {
        activeConnection.talker.read_wcyd = wcyd_fetched;
        if (activeConnection.talker.read_wcyd[7] & vscp.hostCapability.TWO_CONNECTIONS) {
            activeConnection.talker.twoConnectionsAllowed = true;
        }
    }

    if (activeConnection.talker.twoConnectionsAllowed) {
        console.log('Yes, can handle two or more connections');
        openTcpipListnerConnection(conn, activeConnection.talker.chid);
    }

    $("body").css("cursor", "default");

}

///////////////////////////////////////////////////////////////////////////////
// closeConnection
//

let closeConnection = function (conn) {

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

let openTcpipTalkerConnection = async function (conn) {

    let rv = false;

    console.log('Open Talker Connection');

    // Defaults
    let host = 'localhost';
    let port = 9598;

    // Separate from 'host:port' form
    let sep = conn.host.split(':');
    if (sep.length > 1) {
        host = sep[0];
        port = parseInt(sep[1]);
    }
    else {
        host = conn.host;
    }

    vscp_tcp_client_talker = new vscp_tcp_client();

    const value1 = await vscp_tcp_client_talker.connect(
        {
            host: host,
            port: port,
            timeout: conn.connTimeout,
            onSuccess: null
        });

    await vscp_tcp_client_talker.user(
        {
            username: conn.username
        });

    await vscp_tcp_client_talker.password(
        {
            password: conn.password
        });

    // If the connection have an assigned GUID set it
    let guid = vscp.strToGuid(conn.guid);
    if (!isGuidZero(guid)) {
        await setGUID(
            {
                guid: conn.guid
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

let openTcpipListnerConnection = async function (conn, chid) {

    console.log('Open Listner Connection');

    // Defaults
    let host = 'localhost';
    let port = 9598;

    // Separate from 'host:port' form
    let sep = conn.host.split(':');
    if (sep.length > 1) {
        host = sep[0];
        port = parseInt(sep[1]);
    }
    else {
        host = conn.host;
    }

    vscp_tcp_client_listner = new vscp_tcp_client();

    // Add event handler for received events
    vscp_tcp_client_listner.addEventListener((e) => {
        let evobj = ipcRenderer.sendSync('get-vscptype-obj',
            e.vscpClass, e.vscpType);
        console.log(e, evobj.vscpClass.token, evobj.vscpType.token);
        addRxRow('rx', e);
    });

    const value1 = await vscp_tcp_client_listner.connect(
        {
            host: host,
            port: port,
            timeout: conn.connTimeout,
            onSuccess: null
        });

    await vscp_tcp_client_listner.user(
        {
            username: conn.username
        });

    await vscp_tcp_client_listner.password(
        {
            password: conn.password
        });

    // Get the channel id
    activeConnection.listner.channelId = 
        await vscp_tcp_client_listner.getChannelID();

    // Get the channel guid
    activeConnection.listner.channelGuid = 
        await vscp_tcp_client_listner.getGUID();

    // Set filter/mask

    await vscp_tcp_client_listner.startRcvLoop();
}

///////////////////////////////////////////////////////////////////////////////
// closeTalkerConnection
//

let closeTakerConnection = async function (conn) {

    console.log('Close Taker Connection');

    // Disconnect connection
    await vscp_tcp_client_talker.disconnect();

    // Throw to the garbage collector
    vscp_tcp_client_talker = null;
}

///////////////////////////////////////////////////////////////////////////////
// closeListnerConnection
//

let closeListnerConnection = async function (conn) {

    console.log('Close ListnerConnection');

    // Terminate receive loop
    await vscp_tcp_client_listner.stopRcvLoop();

    // Disconnect connection
    await vscp_tcp_client_listner.disconnect();

    // Throw to the garbage collector
    vscp_tcp_client_listner = null;
}
