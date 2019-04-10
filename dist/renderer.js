console.log("hello 1");
var electron = require('electron');
var addon = require('../build/Release/vscphelper');
console.log("hello 2");
var value = 8;
console.log(value + " times 2 equals", addon.my_function(value));
var tbl = document.getElementById("tblRegisters");
//$('body').height(document.documentElement.clientHeight);
// Change the table selector if needed
var $table = $('table.scroll'), $bodyCells = $table.find('tbody tr:first').children(), colWidth;
// Adjust the width of thead cells when window resizes
$(window).resize(function () {
    console.log("scroll");
    // Get the tbody columns width array
    colWidth = $bodyCells.map(function () {
        return $(this).width();
    }).get();
    // Set the width of thead columns
    $table.find('thead tr').children().each(function (i, v) {
        $(v).width(colWidth[i]);
    });
}).resize(); // Trigger resize handler
//# sourceMappingURL=renderer.js.map