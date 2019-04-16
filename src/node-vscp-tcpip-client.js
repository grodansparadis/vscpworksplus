//import { AnyARecord } from "dns";

// Node.js VSCP tcp/ip client
// Built on: https://github.com/ChristopherHackett/node-telnet-client
// https://devhub.io/repos/ChristopherHackett-node-telnet-client
// TODO: * raise and emit errors


/*

send command.
   get OK or ERR response
   timeout

States
======
start 		      - connected to server
response 	- waiting for response after command sent
sentcmd		      - Positive response received

Events
======
connect 	      - Connected to server
writedone 	    - Command has been written
ready           - There is a response
ready		        - Command OK
error		        - Socket error
end             - half closed
close		        - Socket close
timeout		      - Connection timed out
*/

'use strict';

let bDebug = true; // Set to true to enable debug log output

var util = require('util');
var events = require('events');
var net = require('net');

var socket = new net.Socket();

// define a constructor (object) and inherit EventEmitter functions
function vscptcpclient() {
  events.EventEmitter.call(this);
  if (false === (this instanceof vscptcpclient)) return new vscptcpclient();
}

util.inherits(vscptcpclient, events.EventEmitter);

vscptcpclient.prototype.connect = function (opts) {
  var self = this;
  var host = (typeof opts.host !== 'undefined' ? opts.host : '127.0.0.1');
  var port = (typeof opts.port !== 'undefined' ? opts.port : 9598);
  this.timeout = (typeof opts.timeout !== 'undefined' ? opts.timeout : 500);
  this.username = (typeof opts.username !== 'undefined' ? opts.username : 'admin');
  this.password = (typeof opts.password !== 'undefined' ? opts.password : 'secret');
  this.response = '';
  this.vscptcpState;

  this.sock = net.createConnection({
    port: port,
    host: host
  }, function () {

    self.vscptcpState = 'start';  // Current state
    self.stringData = '';         // response data

    // Signal connect
    self.emit('connect');

    // Handle initial response from server after connect
    self.once('ready', function () {

      if (bDebug) console.log('ready response = ' + self.cmdResponse);

      // reset stored response
      self.cmdResponse = null;

    });

  });

  // Report timeout condition
  this.sock.setTimeout(this.timeout, function () {
    if (self.sock._connecting === true) {

      // info: cannot connect; emit error and destroy
      self.emit('error', 'Cannot connect');
      self.sock.destroy();

    }
    else {
      self.emit('timeout');
    }
  });

  this.sock.on('data', function (data) {
    parseData(data, self);
  });

  this.sock.on('error', function (error) {
    self.emit('error', error);
  });

  this.sock.on('end', function () {
    self.emit('end');
  });

  this.sock.on('close', function () {
    self.emit('close');
  });

}

// Send (do/exec) command
vscptcpclient.prototype.docmd = function (cmd, opts/* , callback */) {

  var self = this;
  cmd += '\r\n';
  self.cmdResponse = null;

  /* if (opts && opts instanceof Function) {
    callback = opts;
  }
  else if (opts && opts instanceof Object) {
    self.timeout = opts.timeout || self.timeout;
  } */

  if (this.sock.writable) {

    //if (bDebug) console.log("cmd = " + cmd);
    this.sock.write(cmd, function () {

      self.vscptcpState = 'response';
      self.emit('writedone');

    });

  }

}

vscptcpclient.prototype.end = function () {
  this.sock.end();
}

vscptcpclient.prototype.destroy = function () {
  this.sock.destroy();
}

// Parse response data
function parseData(chunk, vscptcpObj) {

  if (bDebug) console.log('chunk=' + chunk);

  // Take care of data also after connect
  if (vscptcpObj.vscptcpState === 'start') {
    vscptcpObj.vscptcpState = 'response';
  }

  if (vscptcpObj.vscptcpState === 'response') {

    vscptcpObj.stringData += chunk.toString();
    let idx = vscptcpObj.stringData.search("\\+OK -");

    if (bDebug) console.log("idx = " + idx);

    // if no +OK found continue to collect data
    if (idx === -1 && vscptcpObj.stringData.length !== 0) {
      return;
    }

    // Make response string array
    vscptcpObj.cmdResponse = vscptcpObj.stringData.split("\r\n");
    vscptcpObj.stringData = '';

    // remove \r\n ending to get nice table
    vscptcpObj.cmdResponse.pop();

    // Signal that a response is available in cmdResponse
    //if (vscptcpObj.cmdResponse.length) {
    vscptcpObj.emit('ready');
    //}

  }

}



module.exports = vscptcpclient;
