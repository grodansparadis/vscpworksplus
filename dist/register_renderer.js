var sprintf = require('sprintf-js').sprintf;
var floatThead = require('floatthead');
var electron = require('electron');
var addon = require('../build/Release/vscphelper');
console.log("hello 2");
var value = 8;
console.log(value + " times 2 equals", addon.my_function(value));
var tblRegisters = document.getElementById("tblRegisters");
var tblAbstractions = document.getElementById("tblAbstractions");
var tblDM = document.getElementById("tblDM");
var tblWizard = document.getElementById("tblWizard");
// Window is loaded
$(document).ready(function () {
    // Fill sample register content
    addRegisterRow(1, 0, "r-", 2, "This is a simple test fgf fgf gfg fg fg fg ff ffgfgfgfgff  fg gff gffgfgfgffggfgfgg  fg fg    fgf fgf  fgf gff ggffg long");
    addRegisterRow(112, 0x80, "rw", 55, "this is also a test");
    for (var i = 0; i < 200; i++) {
        addRegisterRow(i, 0, "rw", i + 1, sprintf("this is test %d", i));
    }
    // Fill sample content in abstraction table
    addAbstractionRow("Temperature sensor 0", "Signed 16-bit integer", "r-", 19.2, "Main temp. sensor 0");
    addDMRow(1, 2, 3, 4, 5, 6, 7, 8);
    addDMRow(1, 2, 3, 4, 5, 6, 7, 8);
    addDMRow(1, 2, 3, 4, 5, 6, 7, 8);
    addDMRow(1, 2, 3, 4, 5, 6, 7, 8);
    addWizardRow("Hell", "The wizard from hell.");
    addWizardRow("Ozz", "The wizard from ozz.");
});
// Dynamically adjust register header
// HACK!!! Actually don't know why this works (col=0 abs width) but it
// does
function adjustRegisterHeader() {
    document.getElementById('id-head-reg-register').style.width = "400px";
    document.getElementById('id-head-reg-access').style.width = "10%";
    document.getElementById('id-head-reg-content').style.width = "15%";
    document.getElementById('id-head-reg-description').style.width = "60%";
    document.getElementById('id-head-reg-description').style.color = "red";
}
// Add a row to the register table
/* obj {
    reg: Number with register to list
    page: Number with page for register
    access: String with access rights "rw"
    value: Number with register value
    description: String with register description
    fgcolor: String with foreground color (can be empty)
    bgcolor: String with background color (can be empty)
} */
function addRegisterRow(reg, page, access, value, description) {
    var tableRef = tblRegisters.getElementsByTagName('tbody')[0];
    var row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";
    var cellRegister = row.insertCell(0);
    cellRegister.innerHTML = sprintf("%04x:%04x", reg, page);
    cellRegister.classList.add("ctext");
    cellRegister.style.width = "15%";
    var cellRights = row.insertCell(1);
    cellRights.innerHTML = access;
    cellRights.classList.add("ctext");
    cellRights.style.width = "10%";
    var cellValue = row.insertCell(2);
    cellValue.innerHTML = sprintf("%d (0x%02x)", value, value);
    cellValue.classList.add("ctext");
    cellValue.style.width = "15%";
    var cellDescription = row.insertCell(3);
    cellDescription.innerHTML = description;
    cellDescription.style.width = "60%";
    adjustRegisterHeader();
}
// Dynamically adjust abstraction header
// HACK!!! Actually don't know why this works (col=0 abs width) but it
// does
function adjustAbstractionHeader() {
    document.getElementById('id-head-abs-name').style.width = "600px";
    document.getElementById('id-head-abs-type').style.width = "10%";
    document.getElementById('id-head-abs-access').style.width = "10%";
    document.getElementById('id-head-abs-content').style.width = "10%";
    document.getElementById('id-head-abs-description').style.width = "40%";
}
// Add a row to the abstraction table
function addAbstractionRow(name, type, access, value, description) {
    var tableRef = tblAbstractions.getElementsByTagName('tbody')[0];
    var row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";
    var cellName = row.insertCell(0);
    cellName.innerHTML = name;
    cellName.style.width = "30%";
    var cellType = row.insertCell(1);
    cellType.innerHTML = type;
    cellType.classList.add("ctext");
    cellType.style.width = "10%";
    var cellAccess = row.insertCell(2);
    cellAccess.classList.add("ctext");
    cellAccess.innerHTML = access;
    cellAccess.style.width = "10%";
    var cellValue = row.insertCell(3);
    cellValue.classList.add("ctext");
    cellValue.innerHTML = value;
    cellValue.style.width = "10%";
    var cellDescription = row.insertCell(4);
    cellDescription.innerHTML = description;
    cellDescription.style.width = "40%";
    adjustAbstractionHeader();
}
// Dynamically adjust register header
// HACK!!! Actually don't know why this works (col=0 abs width) but it
// does
function adjustDMHeader() {
    document.getElementById('id-head-dm-origin').style.width = "125px";
    document.getElementById('id-head-dm-flags').style.width = "12.5%";
    document.getElementById('id-head-dm-cmask').style.width = "12.5%";
    document.getElementById('id-head-dm-cfilter').style.width = "12.5%";
    document.getElementById('id-head-dm-tmask').style.width = "12.5%";
    document.getElementById('id-head-dm-tfilter').style.width = "12.5%";
    document.getElementById('id-head-dm-action').style.width = "12.5%";
    document.getElementById('id-head-dm-param').style.width = "12.5%";
}
// Add a row to the DM table
function addDMRow(origin, flags, cmask, cfilter, tmask, tfilter, action, param) {
    var tableRef = tblDM.getElementsByTagName('tbody')[0];
    var row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";
    var cellOrigin = row.insertCell(0);
    cellOrigin.innerHTML = origin;
    cellOrigin.style.width = "225px";
    cellOrigin.classList.add("ctext");
    var cellFlag = row.insertCell(1);
    cellFlag.innerHTML = flags;
    cellFlag.style.width = "12.5%";
    cellFlag.classList.add("ctext");
    var cellCMask = row.insertCell(2);
    cellCMask.innerHTML = cmask;
    cellCMask.style.width = "12.5%";
    cellCMask.classList.add("ctext");
    var cellCFilter = row.insertCell(3);
    cellCFilter.innerHTML = cfilter;
    cellCFilter.style.width = "12.5%";
    cellCFilter.classList.add("ctext");
    var cellTMask = row.insertCell(4);
    cellTMask.innerHTML = tmask;
    cellTMask.setAttribute("style", "width: 12.5%");
    cellTMask.classList.add("ctext");
    var cellTFilter = row.insertCell(5);
    cellTFilter.innerHTML = tfilter;
    cellTFilter.setAttribute("style", "width: 12.5%");
    cellTFilter.classList.add("ctext");
    var cellAction = row.insertCell(6);
    cellAction.innerHTML = action;
    cellAction.setAttribute("style", "width: 12.5%");
    cellAction.classList.add("ctext");
    var cellParam = row.insertCell(7);
    cellParam.innerHTML = param;
    cellParam.setAttribute("style", "width: 12.5%");
    cellParam.classList.add("ctext");
    adjustDMHeader();
}
// Dynamically adjust register header
// HACK!!! Actually don't know why this works (col=0 abs width) but it
// does
function adjustWizardHeader() {
    document.getElementById('id-head-wizard-name').style.width = "900px";
    document.getElementById('id-head-wizard-description').style.width = "60%";
}
// Add a row to the Wizard table
function addWizardRow(name, description) {
    var tableRef = tblWizard.getElementsByTagName('tbody')[0];
    var row = tableRef.insertRow(-1);
    row.style.cursor = "pointer";
    var cellName = row.insertCell(0);
    cellName.innerHTML = name;
    cellName.style.width = "900px";
    //cellName.classList.add("ctext");
    var cellDescription = row.insertCell(1);
    cellDescription.innerHTML = description;
    cellDescription.style.width = "60%";
    //cellDescription.classList.add("ctext");
    adjustWizardHeader();
}
//$('body').height(document.documentElement.clientHeight);
// Change the table selector if needed
/* var $table = $('table.scroll'),
    $bodyCells = $table.find('tbody tr:first').children(),
    colWidth: any; */
// Adjust the width of thead cells when window resizes
$(window).resize(function () {
    adjustRegisterHeader();
    adjustAbstractionHeader();
    adjustDMHeader();
    adjustWizardHeader();
    /* console.log("scroll");
    // Get the tbody columns width array
    colWidth = $bodyCells.map(function () {
        return $(this).width();
    }).get();

    // Set the width of thead columns
    $table.find('thead tr').children().each(function (i, v) {
        $(v).width(colWidth[i]);
    }); */
}).resize(); // Trigger resize handler
//# sourceMappingURL=register_renderer.js.map