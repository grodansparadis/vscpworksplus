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

const util = require('util');
const events = require('events');
const net = require('net');
const vscp = require('./vscp');


/* ---------------------------------------------------------------------- */


/**
 * VSCP tcp/ip client, used for connection establishment to a VSCP server.
 * @class
 */
module.exports = Client = function () {

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
     * @param {string} argument     - Server command string argument
     * @param {function} onSuccess  - Function which is called on successful operation
     * @param {function} onerror    - Function which is called on failed operation
     * @param {function} resolve    - Promise resolve function
     * @param {function} reject     - Promise reject function
     */
    var Command = function (command, argument, onSuccess, onError, resolve, reject) {
        /** Server command string
         * @member {string}
         */
        this.command = command;

        /** Server command string arguments
         * @member {string}
         */
        this.argument = argument;

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
    if (false === (this instanceof Client)) return new Client();

    util.inherits(Client, events.EventEmitter);


    /** Get next command from queue with pending commands.
     *
     * @private
     *
     * @return {Command} Command object
     */
    this._getPendingCommand = function () {

        var cmd = null;

        if (0 <= this.cmdQueue.length) {
            cmd = this.cmdQueue[0];
            this.cmdQueue.splice(0, 1);

            return cmd;
        }

        return null;
    };


    /**
     * Signal success of the current asynchronous operation.
     *
     * @private
     * @param {object} [obj]    - Options for on success callback
     */
    this._signalSuccess = function (obj) {

        // Mark as success
        obj.result = 'success';

        // Get command
        var cmd = this._getPendingCommand();


        if (null !== cmd) {

            if (("function" === typeof cmd.onSuccess) && (null !== cmd.onSuccess)) {

                if ("undefined" === typeof obj) {
                    cmd.onSuccess();
                } else {
                    cmd.onSuccess(obj);
                }
            }

            if (("function" === typeof cmd.resolve) && (null !== cmd.resolve)) {

                if ("undefined" === typeof obj) {
                    if (null !== cmd.resolve) {
                        cmd.resolve();
                    }
                } else {
                    /* eslint-disable no-lonely-if */
                    if (null !== cmd.resolve) {
                        cmd.resolve(obj);
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
     * @param {object} [obj]    - Options for on error callback
     */
    this._signalError = function (obj) {

        // Mark as error
        obj.result = 'error';

        var cmd = this._getPendingCommand();

        if (null !== cmd) {

            if (("function" === typeof cmd.onError) && (null !== cmd.onError)) {

                if ("undefined" === typeof obj) {
                    cmd.onError();
                } else {
                    cmd.onError(obj);
                }
            }

            if (("function" === typeof cmd.reject) && (null !== cmd.reject)) {

                if ("undefined" === typeof obj) {
                    if (null !== cmd.reject) {
                        cmd.reject();
                    }
                } else {
                    /* eslint-disable no-lonely-if */
                    if (null !== cmd.reject) {
                        cmd.reject(obj);
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
    this._signalMessage = function (chunk) {

        var status = false;

        if (("function" === typeof this.onMessage) &&
            (null !== this.onMessage)) {

            if (true === this.onMessage(this, chunk)) {
                status = true;
            }
        }

        return status;
    };

    /**
     * Signal a received VSCP event.
     *
     * @private
     * @param {vscp_Event} vscpEvent - VSCP event
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
     * Send command to remote VSCP server and store the command in the internal queue.
     * In some situation only a virtual command shall be stored, but not sent. In this
     * case use set the 'simulate' parameter to true.
     *
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
            console.error(vscp.getTime() + " Options are missing.");
            return;
        }

        if ("string" !== typeof options.command) {
            console.error(vscp.getTime() + " Command is missing.");
            return;
        } else if (0 === options.command) {
            console.error(vscp.getTime() + " Command is empty.");
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

        /* Put command to queue with pending commands */
        cmdObj = new Command(options.command, options.argument, onSuccess, onError, resolve, reject);
        this.cmdQueue.push(cmdObj);

        if (false === simulate) {

            /* Build command string */
            cmdStr = options.command;

            if (0 < cmdArg.length) {
                cmdStr += " " + cmdArg;
            }

            cmdStr += "\r\n"

            /* Send command via tcp/ip to the VSCP server */
            console.debug(vscp.getTime() + " Cmd: " + cmdStr.trim());
            this.socket.write(cmdStr);
        };

    };

    /**
     * Parse remote server version
     */
    this._parseRemoteVersion = function (result) {
        let version = {};
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'version') &&
            (result.response[cntElements - 1]) === '+OK') {
            let verArray = result.response[cntElements - 2].split(',');
            version.major = verArray[0];
            version.minor = verArray[1];
            version.release = verArray[2];
            version.build = verArray[3];
        }
        return version;
    }

    /**
     * Parse remote server pending event queue
     */
    this._parsePendingEventsCount = function (result) {
        let cnt = 0;
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'chkdata') &&
            (result.response[cntElements - 1]) === '+OK') {
            cnt = parseInt(result.response[cntElements - 2]);
        }
        return cnt;
    }

    /**
     * Parse response from interface list and return
     * object with structured interface information
     *
     */
    this._parseInterface = function (result) {
        let interfaces = [];
        let cntElements = result.response.length;
        if (result.response.length &&
            (result.command === 'interface') &&
            (result.response[cntElements - 1]) === '+OK') {
            result.response.pop(); // remove '+OK'
            result.response.forEach((item) => {
                let items = item.split(',');
                let obj = {};
                obj.index = parseInt(items[0]);
                obj.type = parseInt(items[1]);
                obj.guid = vscp.strToGuid(items[2]);
                obj.name = items[3].split('|')[0];
                let startstr = items[3].split('|')[1].substr()
                obj.started = startstr.substr(startstr.length - 19);
                interfaces.push(obj);
            });
        }
        return interfaces;
    }

    /**
     * Parse response from challenge and return
     * challenge string
     */
    this.parseChallenge = function (result) {
        let challenge = "";
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'challenge') &&
            (result.response[cntElements - 1]) === '+OK') {
            challenge = result.response[cntElements - 2];
        }
        return challenge;
    }

    /**
     * Parse response from 'retr n' and return
     * retreived VSCP events in array
     */
    this._parseRetreiveEvents = function (result) {
        let events = [];
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'retr') &&
            (result.response[cntElements - 1]) === '+OK') {
            for (let i = 0; i < (cntElements - 1); i++) {
                e = new vscp.Event();
                e.setFromText(result.response[i]);
                events.push(e);
            }
        }
        return events;
    }

    /**
     * Parse statistics line from remote server
     */
    this._parseStatistics = function (result) {
        let statistics = {};
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'stat') &&
            (result.response[cntElements - 1]) === '+OK') {
            let statsArray = result.response[cntElements - 2].split(',');
            if (statsArray >= 7) {
                statistics.cntReceiveData = parseInt(statsArray[3]);
                statistics.cntReceiveFrames = parseInt(statsArray[4]);
                statistics.cntTransmitData = parseInt(statsArray[5]);
                statistics.cntTransmitFrames = parseInt(statsArray[6]);
            }
        }
        return statistics;
    }

    /**
     * Parse info line from remote server
     */
    this._parseInfo = function (result) {
        let info = {};
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'info') &&
            (result.response[cntElements - 1]) === '+OK') {
            let statsArray = result.response[cntElements - 2].split(',');
            if (statsArray >= 4) {
                info.status = parseInt(statsArray[0]);
                info.lastErrorCode = parseInt(statsArray[1]);
                info.lastErrorSubCode = parseInt(statsArray[2]);
                info.lastErrorStr = statsArray[3];
            }
        }
        return info;
    }

    /**
     * Parse remote server channel id
     */
    this._parseChid = function (result) {
        let chid = -1;
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'chid') &&
            (result.response[cntElements - 1]) === '+OK') {
            chid = parseInt(result.response[cntElements - 2]);
            result.chid = chid;
        }
        return result;
    }

    /**
     * Parse remote server GUID
     */
    this._parseGUID = function (result) {
        let GUID = [];
        let cntElements = result.response.length;
        if ((result.response.length >= 2) &&
            (result.command === 'GETGUID') &&
            (result.response[cntElements - 1]) === '+OK') {
            GUID = vscp.strToGuid(result.response[cntElements - 2]);
            result.guid = GUID;
        }
        return GUID;
    }

    // -----------------------------------------------------------------------------

    /**
     * This function is called for any VSCP server response message.
     *
     * @param {string} chunk - VSCP server response chunk
     */
    Client.prototype.onSrvResponse = function (chunk) {

        var evt = null;
        var responseList = [];

        //console.debug(vscp.getTime() + " Response: " + chunk.toString().trim());

        this.collectedData += chunk.toString();

        /* Send message to application. If the application handled the message,
         * nothing more to. Otherwise the message will be handled now.
         */
        if (false === this._signalMessage(chunk)) {

            // Command response?
            // Save lines up to +OK/-OK
            if (this.state === this.states.CONNECTED) {

                let pos;

                // Positive response? ("+OK ......\r\n")
                if (-1 !== (pos = this.collectedData.search("\\+OK"))) {
                    var response = this.collectedData.substring(0, pos + 3);
                    var lastPart = this.collectedData.substring(pos + 3);
                    if (-1 !== (pos = lastPart.search("\r\n"))) {
                        // save remaining part of server response for further processing
                        this.collectedData = lastPart.substring(pos + 3);
                        responseList = response.split("\r\n");
                        //console.log(responseList);
                        this._signalSuccess(
                            {
                                command: this.cmdQueue[0].command,
                                argument: this.cmdQueue[0].argument,
                                response: responseList
                            });
                    }
                } else if (-1 !== (pos = this.collectedData.search("\\-OK"))) {
                    var response = this.collectedData.substring(0, pos + 3);
                    var lastPart = this.collectedData.substring(pos + 3);
                    if (-1 !== (pos = lastPart.search("\r\n"))) {
                        // save remaining part of server response for further processing
                        this.collectedData = lastPart.substring(pos + 3);
                        responseList = response.split("\r\n");
                        // Negative response
                        this._signalError(
                            {
                                command: this.cmdQueue[0].command,
                                argument: this.cmdQueue[0].argument,
                                response: responseList
                            });
                    }
                }

            } else if (this.state === this.states.RCVLOOP) {

                for (let idx = 0; idx < responseList.length; idx++) {

                    if (-1 !== responseList[idx].search("\\+OK -")) {

                        eventItems = responseList[idx].split(',');
                        evt = new vscp_Event();

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

                        console.debug(vscp.getTime() + " Evt: " +
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
        }

        return;
    };



    /**
     * Connect to a VSCP tcp/ip server with the given host:port.
     *
     * @param {object} options                  - Options
     * @param {string} options.host             - VSCP server to connect to
     * @param {string} options.port             - VSCP server port to connect to
     * @param {string} [options.localaddress]   - Local address the socket should connect from.
     * @param {number} [options.localport]      - Local port the socket should connect from.
     * @param {number} [options.family]         - Version of IP stack, can be either 4 or 6. Default: 4.
     * @param {number} [options.timeout]        - timeout to use for connect operation
     * @param {number} [options.idletimeout]    - idle timeout for connection
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
    Client.prototype.connect = function (options) {

        return new Promise(function (resolve, reject) {

            var connobj = {};
            var idleTimeout = 0;
            var onSuccess = null;

            if (this.states.DISCONNECTED !== this.state) {
                console.error(vscp.getTime() + " A connection already exists.");
                reject(Error("A connection already exists."));
                return;
            }

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" === typeof options.host) {
                this.host = options.host;
            }

            if ("number" === typeof options.port) {
                this.port = options.port;
            }

            if ("string" === typeof options.localhost) {
                connobj.localAddress = options.localhost;
            }

            if ("number" === typeof options.localport) {
                connobj.localPort = options.localport;
            }

            if ("number" === typeof options.family) {
                connobj.family = options.family;
            }

            if ("number" === typeof options.timeout) {
                this.timeout = options.timeout;
            }

            if ("number" === typeof options.idletimeout) {
                idleTimeout = options.idletimeout;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" !== typeof options.onError) {
                this.onConnError = null;
            } else {
                this.onConnError = options.onError;
            }

            console.info(vscp.getTime() +
                " Initiating VSCP tcp/ip client connect to " +
                this.host + ":" + this.port + ")");

            connobj.host = this.host;
            connobj.port = this.port;

            this.socket = net.createConnection(connobj, () => {

                this.socket.on('data', (chunk) => {
                    clearTimeout(timer);
                    this.onSrvResponse(chunk);
                });

                this.socket.once('end', () => {
                    if (this.state !== this.states.DISCONNECTED) {
                        clearTimeout(timer);
                        this.emit('onend');
                        console.info(vscp.getTime() +
                            " tcp/ip connection closed (by remote end).");
                        this.state = this.states.DISCONNECTED;
                        this._signalConnError();
                    }
                });

                console.info(vscp.getTime() +
                    " tcp/ip connection to remote VSCP server established.");
                this.state = this.states.CONNECTED;

                this.emit('onconnect');
                clearTimeout(timer);

                this._sendCommand(
                    {
                        command: "_CONNECT_",
                        data: "",
                        simulate: true,
                        onSuccess: onSuccess,
                        onError: null,
                        resolve: resolve,
                        reject: reject
                    })
            });

            timer = setTimeout(function () {
                console.log("[ERROR] Attempt at connection exceeded timeout value");
                this.socket.end();
                reject(Error("tcp/ip connection timed out."));
            }.bind(this), this.timeout);

            // Report timeout condition
            if (idleTimeout > 0) {
                this.socket.setTimeout(idleTimeout);
            }

            this.socket.on('error', function (error) {
                this.emit('onerror', error);
                clearTimeout(timer);

                console.error(vscp.getTime() +
                    " Could not open a connection.");

                this._signalConnError();

                this.onConnError = null;
                this.onMessage = null;

                reject(Error("Couldn't open a tcp/ip connection."));
            }.bind(this));

            this.socket.on('timeout', function () {
                this.emit('ontimeout');
                console.log('>timeout');
            }.bind(this));

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
    Client.prototype.disconnect = function (options) {

        /* eslint-disable no-unused-vars */
        return new Promise(function (resolve, reject) {
            /* eslint-enable no-unused-vars */

            var onSuccess = null;

            console.info(vscp.getTime() + "[COMMAND] Disconnect VSCP tcp/ip connection.");

            if ("undefined" !== typeof options) {
                console.log(options.onSuccess);
                if ("function" === typeof options.onSuccess) {
                    console.log(1);
                    onSuccess = options.onSuccess;
                }
            }

            this._sendCommand({
                command: "quit",
                simulate: false,
                onSuccess: onSuccess,
                onError: null,
                resolve: resolve,
                reject: reject
            });

            // Free resources for gc
            this.socket.once('onclose', () => {
                if (this.states.DISCONNECTED === this.state) return;
                console.info(vscp.getTime() + ' Disconnected from remote VSCP server!');
                this.onConnError = null;
                this.onMessage = null;
                this.onEvent = [];
                this.socket = null;
                this.state = this.states.DISCONNECTED;
                this.cmdQueue = [];
            });

        }.bind(this));
    };

    /**
     * Send command to remote VSCP server and store the command in the internal queue.
     * In some situation only a virtual command shall be stored, but not sent. In this
     * case use set the 'simulate' parameter to true.
     *
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
    Client.prototype.sendCommand = function (options) {

        /* eslint-disable no-unused-vars */
        return new Promise(function (resolve, reject) {
            /* eslint-enable no-unused-vars */

            var cmdObj = null;
            var cmdStr = "";
            var cmdArg = "";
            var simulate = false;
            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                return;
            }

            if ("string" !== typeof options.command) {
                console.error(vscp.getTime() + " Command is missing.");
                return;
            } else if (0 === options.command) {
                console.error(vscp.getTime() + " Command is empty.");
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

            /* Put command to queue with pending commands */
            cmdObj = new Command(options.command, options.argument,
                onSuccess, onError, resolve, reject);
            this.cmdQueue.push(cmdObj);

            if (false === simulate) {

                /* Build command string */
                cmdStr = options.command;

                if (0 < cmdArg.length) {
                    cmdStr += " " + cmdArg;
                }

                cmdStr += "\r\n"

                /* Send command via tcp/ip to the VSCP server */
                console.debug(vscp.getTime() + " Cmd: " + cmdStr.trim());
                this.socket.write(cmdStr);
            };
        }.bind(this));
    };

    // ----------------------------------------------------------------------------
    //                                Commands
    // ----------------------------------------------------------------------------

    /**
     * Send event to VSCP server.
     *
     * @private
     * @param {object} options              - Options
     * @param {string} options.eventstr     - VSCP event on string form to send
     * @param {function} options.onSuccess  - Callback on success
     * @param {function} options.onError    - Callback on error
     */
    Client.prototype.sendEvent = function (options) {

        /* eslint-disable no-unused-vars */
        return new Promise(function (resolve, reject) {
            /* eslint-enable no-unused-vars */

            var cmdObj = null;
            var cmdStr = "send";
            var eventStr = "";
            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                return;
            }

            if ("string" !== typeof options.eventstr) {
                console.error(vscp.getTime() + " Event string is missing.");
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            sendCommand({
                command: "send",
                argument: options.eventstr,
                onSuccess: onSuccess,
                ObError: onError,
                resolve: resolve,
                reject: reject
            });

        }.bind(this));
    };

    /**
     * Send a VSCP event to the VSCP server.
     *
     * @param {object} options                  - Options
     * @param {vscp_Event} options.event        - VSCP event to send
     * @param {function} [options.onSuccess]    - Function which is called on a
     *                                              successful operation
     * @param {function} [options.onError]      - Function which is called on a
     *                                              failed operation
     *
     * @return {object} Promise
     */
    Client.prototype.sendEvent = function (options) {
        return new Promise(function (resolve, reject) {

            var cmdArg = "";
            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("undefined" === typeof options.event) {
                console.error(vscp.getTime() + " VSCP event is missing.");
                reject(Error("VSCP event is missing."));
                return;
            }

            if (false === options.event instanceof vscp_Event) {
                console.error(vscp.getTime() + " Event is invalid.");
                reject(Error("Event is invalid."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            cmdArg = options.event.getText();

            this.sendEvent({
                eventstr: cmdArg,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Do 'noop' command.
     *
     * @return {boolean} true
     */
    Client.prototype.noop = async function () {
        const result = await this.sendCommand(
            {
                command: "noop",
            });
        return true;
    };

    /**
     * Send 'user' command.
     *
     * @return {object} version
     */
    Client.prototype.user = async function () {
        const result = await this.sendCommand(
            {
                command: "user",
                argument: option.username
            });
        return true;
    };

    /**
     * Send 'password' command.
     *
     * @return {object} version
     */
    Client.prototype.password = async function () {
        const result = await this.sendCommand(
            {
                command: "pass",
                argument: option.password
            });
        return true;
    };

    /**
     * Send 'quit' command.
     *
     * @return {boolean} true
     */
    Client.prototype.quit = async function () {
        const result = await this.sendCommand(
            {
                command: "quit",
            });
        return true;
    };

    /**
     * Send 'challenge' command.
     *
     * @return {string} challenge
     */
    Client.prototype.password = async function () {
        const result = await this.sendCommand(
            {
                command: "challenge",
                argument: option.password
            });
        return parseChallange(result);
    };

    /**
     * Start rcvloop.
     *
     * @return {boolean} true
     */
    Client.prototype.startRcvLoop = async function () {
        const result = await this.sendCommand(
            {
                command: "rcvloop",
            });
        this.state = this.states.RCVLOOP;
        return true;
    };

    /**
     * Stop rcvloop.
     *
     * @return {boolean} Promise
     */
    Client.prototype.stopRcvLoop = async function () {
        const result = await this.sendCommand(
            {
                command: "rcvloop",
            });
        this.state = this.states.CONNECTED;
        return true;
    };

    /**
     * Clear the VSCP event queue on the server side.
     *
     * @return {boolean} true
     */
    Client.prototype.clearQueue = async function () {
        const result = await this.sendCommand(
            {
                command: "clrall",
            });
        return true;
    };

    /**
     * Get pending event count from servers inqueue.
     *
     * @return {object} interfaces
     */
    Client.prototype.getPendingEventCount = async function () {
        const result = await this.sendCommand(
            {
                command: "chkdata",
            });
        return this._parsePendingEventsCount(result);
    };

    /**
     * Get remote server version.
     *
     * @return {object} version
     */
    Client.prototype.getRemoteVersion = async function () {
        const result = await this.sendCommand(
            {
                command: "version",
            });
        return this._parseRemoteVersion(result);
    };

    /**
     * Do 'restart' command.
     *
     * @return {boolean} true
     */
    Client.prototype.restart = async function () {
        const result = await this.sendCommand(
            {
                command: "restart",
                argument: options.password
            });
        return true;
    };

    /**
 * Do 'shutdown' command.
 *
 * @return {boolean} true
 */
    Client.prototype.shutdown = async function () {
        const result = await this.sendCommand(
            {
                command: "shutdown",
                argument: options.password
            });
        return true;
    };

    /**
     * Set a filter in the VSCP server for VSCP events.
     *
     * @param {object} options                          - Options
     * @param {number} [options.filterPriority]         - Priority filter (default: 0)
     * @param {number} [options.filterClass]            - Class filter (default: 0)
     * @param {number} [options.filterType]             - Type filter (default: 0)
     * @param {number[]|string} [options.filterGuid]    - GUID filter (default: 0)
     * @param {function} [options.onSuccess]            - Function which is called on
     *                                                      a successful operation
     * @param {function} [options.onError]              - Function which is called on
     *                                                      a failed operation
     *
     * @return {object} Promise
     */
    Client.prototype.setFilter = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var cmdData = "";
            var filterPriority = 0;
            var filterClass = 0;
            var filterType = 0;
            var filterGuid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
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
                    console.error(vscp.getTime() + " GUID filter length is invalid.");
                    reject(Error("GUID filter length is invalid."));
                    return;
                }

                filterGuid = options.filterGuid;
            } else if ("string" === typeof options.filterGuid) {

                filterGuid = vscp.strToGuid(options.filterGuid);

                if (16 !== filterGuid.length) {
                    console.error(vscp.getTime() + " GUID filter is invalid.");
                    reject(Error("GUID filter is invalid."));
                    return;
                }
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            cmdData = "0x" + filterPriority.toString(16) + ",";
            cmdData += "0x" + filterClass.toString(16) + ",";
            cmdData += "0x" + filterType.toString(16) + ",";

            cmdData += vscp_utility_guidToStr(filterGuid);

            this.sendCommand({
                command: "setfilter",
                argument: cmdData,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Set a mask in the VSCP server for VSCP events.
     *
     * @param {object} options                          - Options
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
    Client.prototype.setMask = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var cmdData = "";
            var maskPriority = 0;
            var maskClass = 0xffff;
            var maskType = 0xffff;
            var maskGuid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
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
                    console.error(vscp.getTime() + " GUID mask length is invalid.");
                    reject(Error("GUID mask length is invalid."));
                    return;
                }

                maskGuid = options.maskGuid;
            } else if ("string" === typeof options.maskGuid) {

                maskGuid = vscp.strToGuid(options.maskGuid);

                if (16 !== maskGuid.length) {
                    console.error(vscp.getTime() + " GUID mask is invalid.");
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

            cmdData += "0x" + maskPriority.toString(16) + ",";
            cmdData += "0x" + maskClass.toString(16) + ",";
            cmdData += "0x" + maskType.toString(16) + ",";

            cmdData += vscp_utility_guidToStr(maskGuid);

            this.sendCommand({
                command: "setmask",
                argument: cmdData,
                onSuccess: onSuccess,
                onError: onError,
                resolve: resolve,
                reject: reject
            });
        }.bind(this));
    };

    /**
     * Get interfaces from server.
     *
     * @param {object} options           - Options
     * @param {number} [options.count]   - # VSCP events to fetch (default: 1)
     * @return {object} interfaces
     */
    Client.prototype.getInterfaces = async function () {
        const result = await this.sendCommand(
            {
                command: "interface",
                argument: "list"
            });
        return this._parseInterface(result);
    };

    /**
     * Retrieve events from server.
     *
     * @param {object} [options]              - Options
     * @param {number} [options.count]        - number of events to fetch
     *                                            default: 1, -1 for all
     * @return {array} Retrieved VSCP events
     */
    Client.prototype.getEvents = async function (options) {

        var count = 1;

        if ("number" === typeof options.count) {
            count = options.count;
        }

        const result = await this.sendCommand(
            {
                command: "retr",
                argument: count
            });
        return this._parseRetreiveEvents(result);
    };

    /**
     * Retrieve statistics from server.
     *
     * @return {object} Retrieved statistics
     */
    Client.prototype.getStatistics = async function () {
        var count = 1;

        const result = await this.sendCommand(
            {
                command: "stat",
            });
        return this._parseStatistics(result);
    };

    /**
     * Retrieve info from server.
     *
     * @return {object} Retrieved info
     */
    Client.prototype.getInfo = async function () {
        var count = 1;

        const result = await this.sendCommand(
            {
                command: "info",
            });
        return this._parseInfo(result);
    };

    /**
     * Retrieve channel id from server.
     *
     * @return {object} Retrieved channel id
     */
    Client.prototype.getChannelID = async function () {
        var count = 1;

        const result = await this.sendCommand(
            {
                command: "chid",
            });
        return this._parseChid(result);
    };

    /**
     * Set GUID for channel.
     *
     * @param {object} options                    - Options
     * @param {number[]|string} [options.guid]    - GUID (default: 0)
     *
     * @return {object} Result object
     */
    Client.prototype.setGUID = async function (options) {
        let guid = '-';

        if (options.guid instanceof Array) {
            if (16 !== options.filterGuid.length) {
                console.error(vscp.getTime() + " GUID length is invalid.");
                reject(Error("GUID length is invalid."));
                return;
            }

            guid = options.guid;
        } else if ("string" === typeof options.guid) {

            guid = vscp.strToGuid(options.guid);

            if (16 !== guid.length) {
                console.error(vscp.getTime() + " GUID is invalid.");
                reject(Error("GUID is invalid."));
                return;
            }
        }

        const result = await this.sendCommand(
            {
                command: "setguid",
                argument: guid
            });
        return result;
    };

    /**
     * Get GUID for interface.
     *
     * @return {object} Result object
     */
    Client.prototype.getGUID = async function (options) {
        let guid = [];

        const result = await this.sendCommand(
            {
                command: "getguid"
            });
        return this._parseGUID(result);
    };

    /**
     * Send measurement to server.
     *
     * @param {object} options                  - Options
     * @param {number} options.type             - VSCP type value specifying which
     *                                             type of measurement this is.
     * @param {number} options.unit             - The measurement unit for this type
     *                                             of measurement. An be in the range 0-3
     *                                             for a Level I event and 0-255 for a
     *                                             Level II event.
     * @param {number} options.sensorindex      - The index for the sensor for the unit.
     *                                             Can be in the range 0-7 for a Level I event
     *                                             and 0-255 for a Level II event.
     * @param {number} options.value            - The measurement value.
     * @param {number[]|string} [options.guid]  - GUID (default: 0)
     * @param {number} [options.level]          - Set to 1 or 2 for Level I or Level II.
     *                                             Default: 2
     * @param {string} [options.eventformat]    - Set to "string" or "float" to generate a
     *                                             string based or a float based event.
     *                                             Default: 'float'
     * @param {number} [options.zone]           - Zone value for Level II events. Defaults to zero.
     * @param {number} [options.subzone]        - Subzone value for Level II events. Defaults to zero.
     *
     * @return {object} Result object
     */
    Client.prototype.sendMeasurement = async function (options) {

        let cmdArg = '';
        let guid = '-';
        let level = 2;
        let evenFormat = 'float';
        let zone = 0;
        let subzone = 0;

        if ("undefined" === typeof options) {
            console.error(vscp.getTime() + " Options is missing.");
            reject(Error("Options is missing."));
            return;
        }

        if ("number" !== typeof options.type) {
            console.error(vscp.getTime() + " Option 'type' is missing.");
            reject(Error("Option 'type' is missing."));
            return;
        }

        cmdArg = options.type.toString() + ',';

        if ("number" !== typeof options.unit) {
            console.error(vscp.getTime() + " Option 'unit' is missing.");
            reject(Error("Option 'unit' is missing."));
            return;
        }

        cmdArg = options.unit.toString() + ',';

        if ("number" !== typeof options.sensorindex) {
            console.error(vscp.getTime() + " Option 'sensorindex' is missing.");
            reject(Error("Option 'sensorindex' is missing."));
            return;
        }

        cmdArg = options.sensorindex.toString() + ',';

        if ("number" !== typeof options.value) {
            console.error(vscp.getTime() + " Option 'value' is missing.");
            reject(Error("Option 'value' is missing."));
            return;
        }

        cmdArg = options.value.toString() + ',';

        if (options.guid instanceof Array) {
            if (16 !== options.filterGuid.length) {
                console.error(vscp.getTime() + " GUID length is invalid.");
                reject(Error("GUID length is invalid."));
                return;
            }

            guid = guidToStr(options.guid);

        } else if ("string" === typeof options.guid) {

            guid = options.guid;

        }

        if ("number" === typeof options.level) {
            if (1 === options.level) {
                level = options.level;
            }
            else if (2 === options.level) {
                level = options.level;
            }
            else {
                console.error(vscp.getTime() + " Option 'level' can only be set to 1 or 2.");
                reject(Error("Option 'level' can only be set to 1 or 2."));
            }
        }

        cmdArg = level.toString() + ',';

        if ("string" === typeof options.eventformat) {
            if ('float' === options.level) {
                eventformat = options.eventformat;
            }
            else if ('string' === options.eventformat) {
                eventformat = options.eventformat;
            }
            else {
                console.error(vscp.getTime() + " Option 'eventformat' can only be set to 'float' or 'string'.");
                reject(Error("Option 'eventformat' can only be set to 'float' or 'string'."));
            }
        }

        cmdArg = eventformat + ',';


        if ("number" === typeof options.zone) {
            zone = options.zone;
        }

        cmdArg = zone.toString() + ',';


        if ("number" === typeof options.subzone) {
            subzone = options.subzone;
        }

        cmdArg = subzone.toString();

        const result = await this.sendCommand(
            {
                command: "measurement",
                argument: cmdArg
            });

        return result;
    };


    // ----------------------------------------------------------------------------
    //                                Variables
    // ----------------------------------------------------------------------------

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
    Client.prototype.createVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var type = vscp_constants_varTypes.STRING;  // Default type is string
            var accessrights = 744;                     // Default access rights
            var persistency = false;                    // Not persistent
            var note = "";                              // No note
            var value = "";

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options is missing.");
                reject(Error("Options is missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Option 'name' is missing.");
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
                console.error(vscp.getTime() + " Option 'persistency' is missing.");
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
                console.error(vscp.getTime() + " Option 'value' is missing.");
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

            this.sendCommand({
                command: "CVAR",
                data: options.name + ";" +
                    type + ";" +
                    accessrights + ";" +
                    (persistency ? 1 : 0) + ";" +
                    vscp_encodeValueIfBase64(type, value) + ";" +
                    vscp_b64EncodeUnicode(note),
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
    Client.prototype.readVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this.sendCommand({
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
    Client.prototype.writeVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var value = "";

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options is missing.");
                reject(Error("Options is missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Option name is missing.");
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
                console.error(vscp.getTime() + " Option 'value' is missing.");
                reject(Error("Option 'value' is missing."));
                return;
            }

            if ("number" !== typeof options.type) {
                console.error(vscp.getTime() + " Option type is missing.");
                reject(Error("Option type is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this.sendCommand({
                command: "WVAR",
                data: options.name + ";" + vscp_encodeValueIfBase64(options.type, value),
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
    Client.prototype.resetVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this.sendCommand({
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
    Client.prototype.removeVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this.sendCommand({
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
    Client.prototype.lengthVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this.sendCommand({
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
    Client.prototype.lastChangeVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Variable name is missing.");
                reject(Error("Variable name is missing."));
                return;
            }

            if ("function" === typeof options.onSuccess) {
                onSuccess = options.onSuccess;
            }

            if ("function" === typeof options.onError) {
                onError = options.onError;
            }

            this.sendCommand({
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
    Client.prototype.listVar = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var regex = "";

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" === typeof options.regex) {
                regex = options.regex;
            }

            if ("function" !== typeof options.onVariable) {
                console.error(vscp.getTime() + " onVariable is missing.");
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

            this.sendCommand({
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
    Client.prototype.readTable = function (options) {
        return new Promise(function (resolve, reject) {

            var onSuccess = null;
            var onError = null;
            var rowBegin = null;
            var rowEnd = null;
            var data = "";

            if ("undefined" === typeof options) {
                console.error(vscp.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.name) {
                console.error(vscp.getTime() + " Table name is missing.");
                reject(Error("Table name is missing."));
                return;
            }

            if ("function" !== typeof options.onTableRow) {
                console.error(vscp.getTime() + " onTableRow function is missing.");
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

            this.sendCommand({
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