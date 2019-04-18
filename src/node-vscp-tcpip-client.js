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
response 	      - waiting for response after command sent
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
  this.onEvent = [];
  var cmdQueue = [];
  this.response = '';
  this.vscptcpState;

  this._signalEvent = function(vscpEvent) {
    var index = 0;

    /* Signal event to all event listeners */
    for (index = 0; index < this.onEvent.length; ++index) {
        if (("function" === typeof this.onEvent[index]) &&
            (null !== this.onEvent[index])) {
            this.onEvent[index](this, vscpEvent);
        }
    }
  };

  /**
     * Add a event listener.
     *
     * @param {function} eventListener - Event listener function
     */
    this.addEventListener = function(eventListener) {
      if ("function" === typeof eventListener) {
          this.onEvent.push(eventListener);
      }
  };

  /**
     * Remove a event listener.
     *
     * @param {function} eventListener - Event listener function
     */
    this.removeEventListener = function(eventListener) {
      var index = 0;

      for (index = 0; index < this.onEvent.length; ++index) {
          if (this.onEvent[index] === eventListener) {
              this.onEvent.splice(index, 1);
          }
      }

  };

  /** Get the index of a command in the queue.
     *
     * @private
     * @param {string} command - Server command string
     *
     * @return {number} Index of command in the queue. If index is < 0, the command was not found.
     */
    this._getPendingCommandIndex = function(command) {

      var index = 0;

      for (index = 0; index < cmdQueue.length; ++index) {
          if (command === cmdQueue[index].command) {
              break;
          }
      }

      if (cmdQueue.length === index) {
          index = -1;
      }

      return index;
  };

  /** Get command from queue with pending commands.
     *
     * @private
     * @param {string} command - Server command string
     *
     * @return {Command} Command object
     */
    this._getPendingCommand = function(command) {

      var index = this._getPendingCommandIndex(command);
      var cmd = null;

      if (0 <= index) {
          cmd = cmdQueue[index];
          cmdQueue.splice(index, 1);

          return cmd;
      }

      return null;
  };

  /**
     * Signal success of the current asynchronous operation.
     *
     * @private
     * @param {string} command  - Server command string
     * @param {object} [obj]    - Options for on success callback
     */
    this._signalSuccess = function(command, obj) {

      var cmd = this._getPendingCommand(command);

      if (null !== cmd) {

          if (("function" === typeof cmd.onSuccess) && (null !== cmd.onSuccess)) {

              if ("undefined" === typeof obj) {
                  cmd.onSuccess(this);
              } else {
                  cmd.onSuccess(this, obj);
              }
          }

          if (("function" === typeof cmd.resolve) && (null !== cmd.resolve)) {

              if ("undefined" === typeof obj) {
                  if (null !== cmd.resolve) {
                      cmd.resolve(this);
                  }
              } else {
                  /* eslint-disable no-lonely-if */
                  if (null !== cmd.resolve) {
                      cmd.resolve(this, obj);
                  }
                  /* eslint-enable no-lonely-if */
              }
          }
      }
  };

  /**
   * Signal failed of the current asynchronous operation.
   *
   * @private
   * @param {string} command  - Server command string
   * @param {object} [obj]    - Options for on error callback
   */
  this._signalError = function(command, obj) {

      var cmd = this._getPendingCommand(command);

      if (null !== cmd) {

          if (("function" === typeof cmd.onError) && (null !== cmd.onError)) {

              if ("undefined" === typeof obj) {
                  cmd.onError(this);
              } else {
                  cmd.onError(this, obj);
              }
          }

          if (("function" === typeof cmd.reject) && (null !== cmd.reject)) {

              if ("undefined" === typeof obj) {
                  if (null !== cmd.reject) {
                      cmd.reject(this);
                  }
              } else {
                  /* eslint-disable no-lonely-if */
                  if (null !== cmd.reject) {
                      cmd.reject(this, obj);
                  }
                  /* eslint-enable no-lonely-if */
              }
          }
      }
  };

  /**
   * Signal a connection error.
   *
   * @private
   */
  this._signalConnError = function() {
      if (("function" === typeof this.onConnError) &&
          (null !== this.onConnError)) {
          this.onConnError(this);
      }
  };

  /**
     * Signal a received VSCP response message.
     * If the message is handled by the application, the application will return
     * true, which means no further actions shall take place in this object.
     * Otherwise the message is handled by the standard onMessage handler here.
     *
     * @private
     * @param {string} msg - VSCP server response message
     *
     * @return {boolean} Message is handled (true) or not (false).
     */
    this._signalMessage = function(msg) {
      var status = false;

      if (("function" === typeof this.onMessage) &&
          (null !== this.onMessage)) {

          if (true === this.onMessage(this, msg)) {
              status = true;
          }
      }

      return status;
  };

    /**
     * Signal a received VSCP event.
     *
     * @private
     * @param {vscp.Event} vscpEvent - VSCP event
     */
    this._signalEvent = function(vscpEvent) {
      var index = 0;

      /* Signal event to all event listeners */
      for (index = 0; index < this.onEvent.length; ++index) {
          if (("function" === typeof this.onEvent[index]) &&
              (null !== this.onEvent[index])) {
              this.onEvent[index](this, vscpEvent);
          }
      }
  };

  /**
     * Signal a received table row.
     *
     * @private
     * @param {object} row          - Table row object
     * @param {string} row.date     - Date and time
     * @param {string} row.value    - Value
     */
    this._signalTableRow = function(row) {
      if (("function" === typeof this.onTableRow) &&
          (null !== this.onTableRow)) {
          this.onTableRow(this, row);
      }
  };

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
