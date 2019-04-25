// VSCP javascript websocket library
//
// Copyright (C) 2012-2019 Ake Hedman, Grodans Paradis AB
// <akhe@grodansparadis.com>
// Copyright (c) 2015-2019 Andreas Merkle
// <vscp@blue-andi.de>
//
// Licence:
// The MIT License (MIT)
// [OSI Approved License]
//
// The MIT License (MIT)
//
// Copyright (c) 2012-2019 Grodans Paradis AB (Paradise of the Frog)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// Alternative licenses for VSCP & Friends may be arranged by contacting
// Grodans Paradis AB at info@grodansparadis.com, http://www.grodansparadis.com
//

/** Namespace for all functionality of the VSCP provided libraries.
 * @namespace vscp
 */
var vscp = vscp || {};

var util = require('util');
var events = require('events');
var net = require('net');

/** Create a general purpose namespace method. This will allow us to create
 * namespace a bit easier.
 *
 * @private
 * @param {string} namespace Complete namespace, e.g. "a.b.c.d"
 */
vscp._createNS = function (namespace) {

    var nsparts = namespace.split(".");
    var parent = vscp;

    /* We want to be able to include or exclude the root namespace .
     * So we strip it if it's in the namespace.
     */
    if (nsparts[0] === "vscp") {
        nsparts = nsparts.slice(1);
    }

    /* Loop through the parts and create a nested namespace if necessary */
    for (var i = 0; i < nsparts.length; i++) {
        var partname = nsparts[i];

        /* Check if the current parent already has the namespace declared, if
         * not create it.
         */
        if ("undefined" === typeof parent[partname]) {
            parent[partname] = {};
        }

        /* Get a reference to the deepest element in the hierarchy so far */
        parent = parent[partname];
    }

    /* The parent is now completely constructed with empty namespaces and can be used. */
    return parent;
};

/**
 * Utility functions
 * @namespace vscp.utility
 */
vscp._createNS("vscp.utility");

/**
 * Utility function which returns the current time in the following format: hh:mm:ss.us
 *
 * @return {string} Current time in the format hh:mm:ss.us
 */
vscp.utility.getTime = function () {

    var now = new Date();

    var paddingHead = function (num, size) {
        var str = num + "";

        while (str.length < size) {
            str = "0" + str;
        }

        return str;
    };

    var paddingTail = function (num, size) {
        var str = num + "";

        while (str.length < size) {
            str = str + "0";
        }

        return str;
    };

    return "" + paddingHead(now.getHours(), 2) + ":" +
        paddingHead(now.getMinutes(), 2) + ":" +
        paddingHead(now.getSeconds(), 2) + "." +
        paddingTail(now.getMilliseconds(), 3);
};

/* ---------------------------------------------------------------------- */


/**
 * VSCP tcp/ip client, used for connection establishment to a VSCP server.
 * @class
 */
module.exports = vscp_tcp_Client = function () {

    /** States of the VSCP client
     * @enum {number}
     */
    this.states = {
        /** Not connected */
        DISCONNECTED: 0,
        /** Standard tcp/ip connection established */
        CONNECTED: 1,
        /** Client connection in remote loop */
        RCVLOOP: 2
    };

    /** tcp/ip socket
     * @member {object}
     */
    this.socket = null;

    /** host used for connection establishment
     * @member {string}
     */
    this.host = "127.0.0.1";

    /** port used for connection establishment
     * @member {number}
     */
    this.port = 9598;

    /** timeout used for connection establishment
     * @member {number}
     */
    this.timeout = 500;

    /** Callback called on any connection error
     * @member {function}
     */
    this.onConnError = null;

    /** Callback called on any received VSCP response message
     * @member {function}
     */
    this.onMessage = null;

    /** Callbacks called on any received VSCP event message
     * @member {function[]}
     */
    this.onEvent = [];

    /** VSCP client is not connected right now
     * @member {number}
     */
    this.state = this.states.DISCONNECTED;

    /** VSCP response data is collected here up to
     * until a "+OK" or "-OK" is found in the stream
    */
    this.collectedData = "";

    /** Queue contains all pending VSCP server commands
     *
     */
    this.cmdQueue = [];

    /** Send VSCP tcp/ip server command
     *
     * @private
     * @class
     * @param {string} command      - Server command string
     * @param {function} onSuccess  - Function which is called on successful operation
     * @param {function} onerror    - Function which is called on failed operation
     * @param {function} resolve    - Promise resolve function
     * @param {function} reject     - Promise reject function
     */
    var Command = function (command, onSuccess, onError, resolve, reject) {
        /** Server command string
         * @member {string}
         */
        this.command = command;

        /** Function which is called on successful operation
         * @member {function}
         */
        this.onSuccess = onSuccess;

        /** Function which is called on failed operation
         * @member {function}
         */
        this.onError = onError;

        /** Function which is called on successful operation
         * @member {function}
         */
        this.resolve = resolve;

        /** Function which is called on failed operation
         * @member {function}
         */
        this.reject = reject;

    };


    // inherit EventEmitter functions
    events.EventEmitter.call(this);
    if (false === (this instanceof vscp_tcp_Client)) return new vscp_tcp_Client();

    util.inherits(vscp_tcp_Client, events.EventEmitter);


    /** Get the index of a command in the queue.
     *
     * @private
     * @param {string} command - Server command
     *
     * @return {number} Index of command in the queue. If index is < 0,
     *          the command was not found.
     */
    this._getPendingCommandIndex = function (command) {

        var index = 0;

        for (index = 0; index < this.cmdQueue.length; ++index) {
            if (command === this.cmdQueue[index].command) {
                break;
            }
        }

        if (this.cmdQueue.length === index) {
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
    this._getPendingCommand = function (command) {

        var index = this._getPendingCommandIndex(command);
        var cmd = null;

        if (0 <= index) {
            cmd = this.cmdQueue[index];
            this.cmdQueue.splice(index, 1);

            return cmd;
        }

        return null;
    };

    /**
     * Send command to remote VSCP server and store the command in the internal queue.
     * In some situation only a virtual command shall be stored, but not sent. In this
     * case use set the 'simulate' parameter to true.
     *
     * @private
     * @param {object} options                  - Options
     * @param {string} options.command          - Command string
     * @param {string} [options.argument]       - Command argument string
     * @param {boolean} [options.simulate]      - Simulate the command (true/false)
     *                                              (default: false)
     * @param {function} [options.onSuccess]    - Callback on success (default: null)
     * @param {function} [options.onError]      - Callback on error (default: null)
     * @param {function} [options.resolve]      - Promise resolve function (default: null)
     * @param {function} [options.reject]       - Promise reject function (default: null)
     */
    this._sendCommand = function (options) {

        var cmdObj = null;
        var cmdStr = "";
        var cmdArg = "";
        var simulate = false;
        var onSuccess = null;
        var onError = null;
        var resolve = null;
        var reject = null;

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return;
        }

        if ("string" !== typeof options.command) {
            console.error(vscp.utility.getTime() + " Command is missing.");
            return;
        } else if (0 === options.command) {
            console.error(vscp.utility.getTime() + " Command is empty.");
            return;
        }

        if ("string" === typeof options.argument) {
            cmdArg = options.argument;
        }

        if ("boolean" === typeof options.simulate) {
            simulate = options.simulate;
        }

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

        if ("function" === typeof options.resolve) {
            resolve = options.resolve;
        }

        if ("function" === typeof options.reject) {
            reject = options.reject;
        }

        console.debug(vscp.utility.getTime() + " _sendCommand: " + options.command);

        /* Put command to queue with pending commands */
        cmdObj = new Command(options.command, onSuccess, onError, resolve, reject);
        this.cmdQueue.push(cmdObj);

        if (false === simulate) {

            /* Build command string */
            cmdStr += options.command;

            if (0 < cmdArg.length) {
                cmdStr += " " + cmdArg + "\r\n";
            }

            /* Send command via tcp/ip to the VSCP server */
            console.debug(vscp.utility.getTime() + " Cmd: " + cmdStr);
            this.socket.send(cmdStr);
        }
    };

    /**
     * Send event to VSCP server.
     *
     * @private
     * @param {object} options              - Options
     * @param {string} options.data         - Data string
     * @param {function} options.onSuccess  - Callback on success
     * @param {function} options.onError    - Callback on error
     */
    this._sendEvent = function (options) {

        var cmdObj = null;
        var cmdStr = "E;";
        var onSuccess = null;
        var onError = null;

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return;
        }

        if ("string" !== typeof options.data) {
            console.error(vscp.utility.getTime() + " Command data is missing.");
            return;
        }

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

        /* Put command to queue with pending commands */
        cmdObj = new Command("EVENT", onSuccess, onError);
        this.cmdQueue.push(cmdObj);

        /* Build command string */
        cmdStr += options.data;

        /* Send command via tcp/ip to the VSCP server */
        console.debug(vscp.utility.getTime() + " Cmd: " + cmdStr);
        this.socket.send(cmdStr);
    };

    /**
     * Signal success of the current asynchronous operation.
     *
     * @private
     * @param {string} command  - Server command string
     * @param {object} [obj]    - Options for on success callback
     */
    this._signalSuccess = function (command, obj) {

        console.log("_signalSuccess " + command);
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
    this._signalError = function (command, obj) {

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
    this._signalConnError = function () {
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
    this._signalMessage = function (msg) {

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
    this._signalEvent = function (vscpEvent) {
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
     * Add an event listener.
     *
     * @param {function} eventListener - Event listener function
     */
    this.addEventListener = function (eventListener) {
        if ("function" === typeof eventListener) {
            this.onEvent.push(eventListener);
        }
    };

    /**
     * Remove an event listener.
     *
     * @param {function} eventListener - Event listener function
     */
    this.removeEventListener = function (eventListener) {
        var index = 0;

        for (index = 0; index < this.onEvent.length; ++index) {
            if (this.onEvent[index] === eventListener) {
                this.onEvent.splice(index, 1);
            }
        }

    };



    /**
     * This function is called by the tcp/ip when the connection is established.
     */
    vscp_tcp_Client.prototype.onConnectionOpen = function () {

        console.info(vscp.utility.getTime() + " tcp/ip connection established.");
        this.state = this.states.CONNECTED;

    };

    /**
     * This function is called by the net sublayer in case that the connection is closed.
     */
    vscp_tcp_Client.prototype.onConnectionClose = function () {

        console.info(vscp.utility.getTime() + " tcp/ip connection closed.");
        this.state = this.states.DISCONNECTED;
        this._signalConnError();
    };

    /**
     * This function is called for any VSCP server response message.
     *
     * @param {string} chunk - VSCP server response chunk
     */
    vscp_tcp_Client.prototype.onSrvResponse = function (chunk) {

        var evt = null;
        var responseList = [];

        console.debug(vscp.utility.getTime() + " Response: " + chunk);

        this.collectedData += chunk.toString();
        responseList = this.collectedData.split("\r\n");
        // remove \r\n ending to get nice table
        responseList.pop();

        /* Send message to application. If the application handled the message,
         * nothing more to. Otherwise the message will be handled now.
         */
        if (false === this._signalMessage(chunk)) {

            // Command response?
            // Save lines up to +OK/-OK
            if (this.state === this.states.CONNECTED) {

                let pos;
                let index = 0;

                // Positive response?
                if (-1 !== (pos = this.collectedData.search("\\+OK"))) {
                    var lastPart = this.collectedData.subString(pos+3);
                    // (\r\n|\r|\n)
                    console.log('Found +OK');
                    this._signalSuccess("_CONNECT_", {
                        command: "_CONNECT_",
                        response: responseList
                    });
                } else if (-1 !== (pos = this.collectedData.search("\\-OK"))) {
                    // Negative response
                    console.log('Error');
                }

            } else if (this.state === this.states.RCVLOOP) {

                for (let idx = 0; idx < responseList.length; idx++) {

                    if (-1 !== responseList[idx].search("\\+OK -")) {

                        eventItems = responseList[idx].split(',');
                        evt = new vscp.Event();

                        evt.vscpHead = parseInt(eventItems[0]);
                        evt.vscpClass = parseInt(eventItems[1]);
                        evt.vscpType = parseInt(eventItems[2]);
                        evt.vscpObId = parseInt(eventItems[3]);

                        if (0 < eventItems[4].length) {
                            evt.vscpDateTime = new Date(eventItems[4]);
                        }
                        else {
                            evt.vscpDateTime = new Date();
                        }

                        evt.vscpTimeStamp = parseInt(eventItems[5]);
                        evt.vscpGuid = eventItems[6];
                        evt.vscpData = [];

                        if ((512 <= evt.vscpClass) && (1024 > evt.vscpClass)) {
                            offset = 16;
                        }

                        for (index = 0; index < (eventItems.length - 7 - offset); ++index) {
                            evt.vscpData[index] = parseInt(eventItems[offset + 7 + index]);
                        }

                        console.debug(vscp.utility.getTime() + " Evt: " +
                            " CLASS = " + evt.vscpClass +
                            " TYPE = " + evt.vscpType +
                            " GUID = " + evt.vscpGuid +
                            " DATETIME = " + evt.vscpDateTime.toISOString() +
                            " PRIORITY = " + evt.getPriority() +
                            " DATA = " + evt.vscpData);

                        this._signalEvent(evt);
                    } else if (-1 !== responseList[idx].search("\\-OK -")) {
                        // todo error
                    }
                    else {
                        // todo "we are alive"
                    }
                }
            }
            else {
                console.log('invalid state');
            }
        } else {
            console.log('handled');
        }

        return;
    };



    /**
     * Connect to a VSCP tcp/ip server with the given host:port.
     *
     * @param {object} options                  - Options
     * @param {string} options.host             - VSCP server to connect to
     * @param {string} options.port             - VSCP server port to connect to
     * @param {string} options.timeout          - timeout to use
     * @param {function} [options.onMessage]    - Function which is called on any received
     *                                              VSCP response message.
     * @param {function} [options.onSuccess]    - Function which is called on a successful
     *                                              connection establishment.
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed connection establishment or in
     *                                              case the connection is lost during the
     *                                              session.
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.connect = function (options) {

        return new Promise(function (resolve, reject) {

            var onSuccess = null;

            if (this.states.DISCONNECTED !== this.state) {
                console.error(vscp.utility.getTime() + " A connection already exists.");
                reject(Error("A connection already exists."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.host) {
                this.host = options.host;
            }

            if ("number" === typeof options.port) {
                this.port = options.port;
            }

            if ("number" === typeof options.timeout) {
                this.timeout = options.timeout;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" !== typeof options.onError) {
                this.onConnError = null;
            } else {
                this.onConnError = options.onError;
            }

            console.info(vscp.utility.getTime() +
                " Initiating VSCP tcp/ip client connect to " + this.host + ":" + this.port +
                " (user name: " + this.userName + ", password: " + this.password + ")");

            this.socket = net.createConnection({
                port: this.port,
                host: this.host
            }, () => {

                console.info(vscp.utility.getTime() + ' Connected to remote VSCP server!');
                this.state = this.states.CONNECTED;

                this._sendCommand({
                    command: "_CONNECT_",
                    data: "",
                    simulate: true,
                    onSuccess: onSuccess,
                    onError: null,
                    resolve: resolve,
                    reject: reject
                })

                // //this.socket.onopen =
                // this.socket.on('connect', () => {
                //     console.log('Connect');
                //     this.emit('onconnect');
                // });//.bind(this);

                // this.socket.onclose = this.socket.on('close', () => {
                //     console.log('Disconnect');
                // });//.bind(this);

                // this.socket.onmessage = this.socket.on('data', (chunk) => {
                //     console.log('data');
                // });//.bind(this);

                this.socket.on('data', (chunk) => {
                    this.onSrvResponse(chunk);
                });

                //this._signalSuccess("_CONNECT_");
            });

            // Report timeout condition
            this.socket.setTimeout(this.timeout);

            this.socket.once('error', (err) => {
                console.error(vscp.utility.getTime() +
                    " Couldn't open a tcp/ip connection.");

                this._signalConnError.call(this);

                this.onConnError = null;
                this.onMessage = null;

                reject(this, Error("Couldn't open a tcp/ip connection."));
            });

            this.socket.once('connect', function () {
                console.log('>connect');
                //this.onConnectionOpen();
            });

            this.socket.on('data', function (data) {
                //parseData(data, this);
                console.log('>data');
            });

            this.socket.on('error', function (error) {
                this.emit('onerror', error);
            });

            this.socket.on('end', function () {
                this.emit('onend');
            });

            this.socket.on('close', function () {
                this.emit('onclose');
                //this.onConnectionClose();
            });

        }.bind(this));
    };

    /**
     * Disconnect from a VSCP server.
     *
     * @param {object} options                  - Options
     * @param {function} [options.onSuccess]    - Function which is called on a successful
     *                                              disconnection.
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.disconnect = function (options) {

        /* eslint-disable no-unused-vars */
        return new Promise(function (resolve, reject) {
            /* eslint-enable no-unused-vars */

            var onSuccess = null;

            console.info(vscp.utility.getTime() + " Disconnect VSCP tcp/ip  connection.");

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            this._sendCommand({
                command: "_DISCONNECT_",
                simulate: true,
                onSuccess: onSuccess,
                onError: null,
                resolve: resolve,
                reject: reject
            });

            // Close socket
            socket.end(() => {
                console.info(vscp.utility.getTime() + 'disconnected from remote VSCP server!');
                this.onConnError = null;
                this.onMessage = null;
                this.onEvent = [];
                this.socket.close();
                this.socket = null;
                this.state = this.states.DISCONNECTED;
                this.substate = this.substates.CLOSED;
                this.cmdQueue = [];
            });

            this._signalSuccess("DISCONNECT");

        }.bind(this));
    };

    /**
     * Start rcvloop.
     *
     * @param {object} options                  - Options
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.rcvloop_start = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if (this.states.AUTHENTICATED !== this.state) {
                console.error(vscp.utility.getTime() + " Connection is not authenticated.");
                reject(Error("Connection is not authenticated."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "RCVLOOP",
                data: "",
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Stop rcvloop.
     *
     * @param {object} options                  - Options
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.rcvloop_stop = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if (this.states.AUTHENTICATED !== this.state) {
                console.error(vscp.utility.getTime() + " Connection is not authenticated.");
                reject(Error("Connection is not authenticated."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "QUITLOOP",
                data: "",
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Clear the VSCP event queue on the server side.
     *
     * @param {object} options                  - Options
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.clearQueue = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if (this.states.AUTHENTICATED !== this.state) {
                console.error(vscp.utility.getTime() + " Connection is not authenticated.");
                reject(Error("Connection is not authenticated."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "CLRQ",
                data: "",
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Send a VSCP event to the VSCP server.
     *
     * @param {object} options                  - Options
     * @param {vscp.Event} options.event        - VSCP event to send
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.sendEvent = function (options) {
        return new Promise(function (resolve, reject) {

            var cmdData = "";
            var onSuccess = null;
            var onError = null;

            if (this.states.AUTHENTICATED !== this.state) {
                console.error(vscp.utility.getTime() + " Connection is not authenticated.");
                reject(Error("Connection is not authenticated."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("undefined" === typeof options.event) {
                console.error(vscp.utility.getTime() + " VSCP event is missing.");
                reject(Error("VSCP event is missing."));
                return;
            }

            if (false === options.event instanceof vscp.Event) {
                console.error(vscp.utility.getTime() + " Event is invalid.");
                reject(Error("Event is invalid."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            cmdData = options.event.getText();

            this._sendEvent({
                data: cmdData,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Set a filter in the VSCP server for VSCP events.
     *
     * @param {object} options                          - Options
     * @param {number} [options.filterPriority]         - Priority filter (default: 0)
     * @param {number} [options.filterClass]            - Class filter (default: 0)
     * @param {number} [options.filterType]             - Type filter (default: 0)
     * @param {number[]|string} [options.filterGuid]    - GUID filter (default: 0)
     * @param {number} [options.maskPriority]           - Priority mask (default: 0)
     * @param {number} [options.maskClass]              - Class mask (default: 0xffff)
     * @param {number} [options.maskType]               - Type mask (default: 0xffff)
     * @param {number[]|string} [options.maskGuid]      - GUID mask (default: 0)
     * @param {function} [options.onSuccess]            - Function which is called on
     *                                                      a successful operation
     * @param {function} [options.onError]              - Function which is called on
     *                                                      a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.setFilter = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var cmdData = "";
            var filterPriority = 0;
            var filterClass = 0;
            var filterType = 0;
            var filterGuid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            var maskPriority = 0;
            var maskClass = 0xffff;
            var maskType = 0xffff;
            var maskGuid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            if (this.states.AUTHENTICATED !== this.state) {
                console.error(vscp.utility.getTime() + " Connection is not authenticated.");
                reject(Error("Connection is not authenticated."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("number" === typeof options.filterPriority) {
                filterPriority = options.filterPriority;
            }

            if ("number" === typeof options.filterClass) {
                filterClass = options.filterClass;
            }

            if ("number" === typeof options.filterType) {
                filterType = options.filterType;
            }

            if (options.filterGuid instanceof Array) {
                if (16 !== options.filterGuid.length) {
                    console.error(vscp.utility.getTime() + " GUID filter length is invalid.");
                    reject(Error("GUID filter length is invalid."));
                    return;
                }

                filterGuid = options.filterGuid;
            } else if ("string" === typeof options.filterGuid) {

                filterGuid = vscp.utility.strToGuid(options.filterGuid);

                if (16 !== filterGuid.length) {
                    console.error(vscp.utility.getTime() + " GUID filter is invalid.");
                    reject(Error("GUID filter is invalid."));
                    return;
                }
            }

            if ("number" === typeof options.maskPriority) {
                maskPriority = options.maskPriority;
            }

            if ("number" === typeof options.maskClass) {
                maskClass = options.maskClass;
            }

            if ("number" === typeof options.maskType) {
                maskType = options.maskType;
            }

            if (options.maskGuid instanceof Array) {
                if (16 !== options.maskGuid.length) {
                    console.error(vscp.utility.getTime() + " GUID mask length is invalid.");
                    reject(Error("GUID mask length is invalid."));
                    return;
                }

                maskGuid = options.maskGuid;
            } else if ("string" === typeof options.maskGuid) {

                maskGuid = vscp.utility.strToGuid(options.maskGuid);

                if (16 !== maskGuid.length) {
                    console.error(vscp.utility.getTime() + " GUID mask is invalid.");
                    reject(Error("GUID mask is invalid."));
                    return;
                }
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            cmdData += "0x" + filterPriority.toString(16) + ",";
            cmdData += "0x" + filterClass.toString(16) + ",";
            cmdData += "0x" + filterType.toString(16) + ",";

            cmdData += vscp.utility.guidToStr(filterGuid);

            cmdData += ";";
            cmdData += "0x" + maskPriority.toString(16) + ",";
            cmdData += "0x" + maskClass.toString(16) + ",";
            cmdData += "0x" + maskType.toString(16) + ",";

            cmdData += vscp.utility.guidToStr(maskGuid);

            this._sendCommand({
                command: "SF",
                data: cmdData,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Create a a VSCP remote variable.
     *
     * @param {object} options                      - Options
     * @param {string} options.name                 - Variable name
     * @param {number} [options.type]               - Variable type (default: string)
     * @param {number} [options.accessrights]       - Variable value (default: 744)
     * @param {boolean} options.persistency         - Variable is persistent (true) or not (false)
     * @param {string} options.value                - Variable Value
     * @param {string} [options.note]               - Variable note (optional)
     * @param {function} [options.onSuccess]        - Function which is called on
     *                                                  a successful operation
     * @param {function} [options.onError]          - Function which is called on
     *                                                  a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.createVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var type = vscp.constants.varTypes.STRING;  // Default type is string
            var accessrights = 744;                     // Default access rights
            var persistency = false;                    // Not persistent
            var note = "";                              // No note
            var value = "";

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options is missing.");
                reject(Error("Options is missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Option 'name' is missing.");
                reject(Error("Option 'name' is missing."));
                return;
            }

            if ("number" === typeof options.type) {
                type = options.type;
            }

            if ("number" === typeof options.accessrights) {
                accessrights = options.accessrights;
            }

            if ("string" === typeof options.persistency) {

                if ('false' === options.persistency.toLowerCase()) {
                    persistency = false;
                }
                else {
                    persistency = true;
                }
            }
            else if ("boolean" === typeof options.persistency) {
                persistency = options.persistency;
            }
            else {
                console.error(vscp.utility.getTime() + " Option 'persistency' is missing.");
                reject(Error("Option 'persistency' is missing."));
                return;
            }

            if ("string" !== typeof options.value) {
                value = options.value;
            }
            else if ("number" !== typeof options.value) {
                value = options.value.toString();
            }
            else if ("boolean" !== typeof options.value) {
                value = (options.value ? "true" : "false");
            }
            else {
                console.error(vscp.utility.getTime() + " Option 'value' is missing.");
                reject(Error("Option 'value' is missing."));
                return;
            }

            if ("string" === typeof options.note) {
                note = options.note;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "CVAR",
                data: options.name + ";" +
                    type + ";" +
                    accessrights + ";" +
                    (persistency ? 1 : 0) + ";" +
                    vscp.encodeValueIfBase64(type, value) + ";" +
                    vscp.b64EncodeUnicode(note),
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Read a value from a VSCP server variable.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.readVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "RVAR",
                data: options.name,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Write a value to a VSCP server variable.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {string} options.value            - Variable value
     * @param {number} options.type             - Variable type
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.writeVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var value = "";

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options is missing.");
                reject(Error("Options is missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Option name is missing.");
                reject(Error("Option name is missing."));
                return;
            }

            if ("string" !== typeof options.value) {
                value = options.value;
            }
            else if ("number" !== typeof options.value) {
                value = options.value.toString();
            }
            else if ("boolean" !== typeof options.value) {
                value = (options.value ? "true" : "false");
            }
            else {
                console.error(vscp.utility.getTime() + " Option 'value' is missing.");
                reject(Error("Option 'value' is missing."));
                return;
            }

            if ("number" !== typeof options.type) {
                console.error(vscp.utility.getTime() + " Option type is missing.");
                reject(Error("Option type is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "WVAR",
                data: options.name + ";" + vscp.encodeValueIfBase64(options.type, value),
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };



    /**
     * Reset a VSCP server variable.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.resetVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "RSTVAR",
                data: options.name,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Remove a VSCP server variable.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.removeVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "DELVAR",
                data: options.name,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Get a VSCP server variable length.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.lengthVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "LENVAR",
                data: options.name,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Get last change of a VSCP server variable.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.lastChangeVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "LCVAR",
                data: options.name,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * List all VSCP server variables.
     *
     * @param {object} options                  - Options
     * @param {string} [options.regex]          - Regular expression to filter variables
     * @param {function} options.onVariable     - Function which is called per variable
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.listVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var regex = "";

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" === typeof options.regex) {
                regex = options.regex;
            }

            if ("function" !== typeof options.onVariable) {
                console.error(vscp.utility.getTime() + " onVariable is missing.");
                reject(Error("onVariable is missing."));
                return;
            }

            this.onVariable = options.onVariable;

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this._sendCommand({
                command: "LSTVAR",
                data: regex,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };


    /**
     * Get data from a table.
     * If "begin" and "end" are omitted, the whole table is returned.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Table name
     * @param {string} options.begin            - Date when to begin ( ISO form YY-MM-DD HH:MM:SS )
     * @param {string} options.end              - Date when to end ( ISO form YY-MM-DD HH:MM:SS )
     * @param {function} options.onTableRow     - Function which is called on every received table row
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    vscp_tcp_Client.prototype.readTable = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var rowBegin = null;
            var rowEnd = null;
            var data = "";

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.utility.getTime() + " Table name is missing.");
                reject(Error("Table name is missing."));
                return;
            }

            if ("function" !== typeof options.onTableRow) {
                console.error(vscp.utility.getTime() + " onTableRow function is missing.");
                reject(Error("onTableRow function is missing."));
                return;
            }

            this.onTableRow = options.onTableRow;

            if ("string" === typeof options.begin) {
                rowBegin = options.begin;
            }
            else if (true === (options.begin instanceof Date)) {
                rowBegin = options.begin.toISOString()
            }

            if ("string" === typeof options.end) {
                rowEnd = options.end;
            }
            else if (true === (options.end instanceof Date)) {
                rowEnd = options.begin.toISOString()
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            data = options.name;

            if ((null !== rowBegin) &&
                (null !== rowEnd)) {

                data += ";" + rowBegin + ";" + rowEnd;
            } else {
                data += ";;";
            }

            this._sendCommand({
                command: "TBL_GET",
                data: data,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };
}