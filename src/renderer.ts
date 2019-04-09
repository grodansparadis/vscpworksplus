console.log("hello 1");
const electron = require('electron');
const addon = require('../build/Release/vscphelper');
console.log("hello 2");

const value = 8;
console.log(`${value} times 2 equals`, addon.my_function(value));

let tbl = document.getElementById("tblRegisters");