console.log("renderer main - start");

const electron = require("electron");

let tblMain = document.getElementById("main-table-id");

// electron.ipcRenderer.on('reply-connection-object', (event, arg) => {
//     console.log(arg) // prints "pong"
// })

// electron.ipcRenderer.send('asynchronous-message', 'ping');

$(document).ready(function ($) {
    console.log("Loaded");
    let connections = electron.ipcRenderer.sendSync('get-connection-object');
    connections.vscpinterface.forEach((item) => {
        console.log(item.name);
        addConnectionRow( item.name, "Hola bandola");
    });
});

// Add a row to the Wizard table
function addConnectionRow(name, description) {

    let tableRef = tblMain.getElementsByTagName('tbody')[0];
    let row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";

    let cellName = row.insertCell(0);
    cellName.innerHTML = name;
    cellName.style.width = "900px";
    //cellName.classList.add("ctext");

    let cellDescription = row.insertCell(1);
    cellDescription.innerHTML = description;
    cellDescription.style.width = "60%";
    //cellDescription.classList.add("ctext");

    //adjustWizardHeader();
}

// $(window).load( () => {

// });


// Select table row
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

// Open table row
$('#main-table-id > tbody > tr').on('dblclick', function () {
    console.log("Row double-click");
});

$(document).ready(function ($) {
    $(".table-row").click(function () {
        console.log("new-click");
    });
});

$(function () {
    $(".nav-link").on("click", "li", function (event) {
        console.log("You clicked the drop downs", event)
    })
})

$('#myTab a').click(function (e) {
    e.preventDefault();
    ($(this)).tab('show');
    console.log("tab-click");
})

console.log("renderer main - end");