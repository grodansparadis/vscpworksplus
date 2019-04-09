console.log("hello 1");
var electron = require('electron');
var addon = require('../build/Release/vscphelper');
console.log("hello 2");
var value = 8;
console.log(value + " times 2 equals", addon.my_function(value));
var tbl = document.getElementById("tblRegisters");
//# sourceMappingURL=renderer.js.map