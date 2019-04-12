"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log("renderer main - start");
var electron_1 = require("electron");
console.log(electron_1.ipcRenderer.sendSync('synchronous-message', 'ping')); // prints "pong"
electron_1.ipcRenderer.on('asynchronous-reply', function (event, arg) {
    console.log(arg); // prints "pong"
});
electron_1.ipcRenderer.send('asynchronous-message', 'ping');
//$(window).load(function(){
//});
$('#main-table-id > tbody > tr').on('click', function () {
    var values = [];
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
        console.log("You clicked the drop downs", event);
    });
});
$('#myTab a').click(function (e) {
    e.preventDefault();
    $(this).tab('show');
    console.log("tab-click");
});
console.log("renderer main - end");
//# sourceMappingURL=main_renderer.js.map