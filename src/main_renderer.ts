console.log("renderer main - start");
import { ipcRenderer } from "electron";

console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

ipcRenderer.on('asynchronous-reply', (event: any, arg: any) => {
    console.log(arg) // prints "pong"
})

ipcRenderer.send('asynchronous-message', 'ping');


//$(window).load(function(){

//});

$('#main-table-id > tbody > tr').on('click', function () {
    var values: any = [];
    var count = 0;
    console.log("Row click");
    $(this).find("td").each(function () {
        values[count] = $(this).text();
        count++;
    });
    console.log(count, values);
});

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
    (<any>$(this)).tab('show');
    console.log("tab-click");
})

console.log("renderer main - end");