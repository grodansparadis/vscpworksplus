// VSCP javascript websocket library
//
// Copyright © 2012-2020 Ake Hedman, Grodans Paradis AB
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
const vscp = require('node-vscp');

/* ---------------------------------------------------------------------- */


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
module.exports = Command = function (command, argument, onSuccess, onError, resolve, reject) {

    /** Server command string
     * @member {string}
     */
    this.command = command.toUpperCase();

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
                this.onEvent[index](vscpEvent);
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
      *                                            (default: false)
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
        cmdObj = new Command(options.command, options.argument,
            onSuccess, onError,
            resolve, reject);
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

    return this;

}; // constructor


// ----------------------------------------------------------------------------
//                              Response Parsers
// ----------------------------------------------------------------------------


/**
 * Parse remote server version
 *
 * @param {string array} result   - Command response from remote server
 * @return {object}               - Server version object
 */
Client.prototype.parseRemoteVersion = function (result) {
    let version = {};
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'VERSION') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
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
 *
 * @param {string array} result   - Command response from remote server
 * @return {number}               - Number of events in inqueue.
 */
Client.prototype.parsePendingEventsCount = function (result) {
    let cnt = 0;
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'CHKDATA') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        cnt = parseInt(result.response[cntElements - 2]);
    }
    return cnt;
}

/**
 * Parse response from interface list and return
 * object with structured interface information
 *
 * @param {string array} result   - Command response from remote server
 * @return {object array}         - Array with interface objects
 */
Client.prototype.parseInterface = function (result) {
    let interfaces = [];
    let cntElements = result.response.length;
    if (result.response.length &&
        (result.command === 'INTERFACE LIST') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        result.response.pop(); // remove '+OK'
        result.response.forEach((item) => {
            let items = item.split(',');
            let obj = {};
            obj.index = parseInt(items[0]);
            obj.type = parseInt(items[1]);
            obj.guid = items[2];
            obj.name = items[3].split('|')[0];
            let startStr = items[3].split('|')[1].substr()
            obj.started = startStr.substr(startStr.length - 19);
            interfaces.push(obj);
        });
    }

    return interfaces;
}

/**
 * Parse response from challenge and return
 * challenge string
 *
 * @param {string array} result   - Command response from remote server
 * @return {string}               - Challenge key.
 */
Client.prototype.parseChallenge = function (result) {
    let challenge = "";
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'CHALLENGE') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        challenge = result.response[cntElements - 2];
    }

    return challenge;
}

/**
 * Parse response from 'retr n' and return
 * retrieved VSCP events in array
 *
 * @param {string array} result   - Command response from remote server
 * @return {object array}         - Array with VSCP objectS
 */
Client.prototype.parseRetrieveEvents = function (result) {
    let events = [];
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'RETR') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
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
 *
 * @param {string array} result   - Command response from remote server
 * @return {object}               - Statistics object
 */
Client.prototype.parseStatistics = function (result) {
    let statistics = {};
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'STAT') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
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
 *
 * @param {string array} result   - Command response from remote server
 * @return {object}               - Info. object
 */
Client.prototype.parseInfo = function (result) {
    let info = {};
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'INFO') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        let statsArray = result.response[cntElements - 2].split(',');
        if (statsArray >= 4) {
            info.status = parseInt(statsArray[0]);
            info.lastErrorCode = parseInt(statsArray[1]);
            info.lastErrorSubCode = parseInt(statsArray[2]);
            info.lastErrorStr = statsArray[3];
        }
    }

    return info;
};

/**
 * Parse remote server channel id
 *
 * @param {string array} result   - Command response from remote server
 * @return {number}               - Server channel id.
 *
 */
Client.prototype.parseChid = function (result) {
    let chid = -1;
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'CHID') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        chid = parseInt(result.response[cntElements - 2]);
        result.chid = chid;
    }

    return chid;
}

/**
 * Parse remote server GUID
 *
 * @param {string array} result   - Command response from remote server
 * @return {numeric array}        - GUID
 */
Client.prototype.parseGUID = function (result) {
    let GUID = [];
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'GETGUID') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        GUID = result.response[cntElements - 2];
        result.guid = GUID;
    }

    return GUID;
}



/**
 * Parse remote server WCYD code
 *
 * @param {string array} result   - Command response from remote server
 * @return {numeric array}        - What can you do array
 */
Client.prototype.parseWcyd = function (result) {
    let wcyd = [];
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'WCYD') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        wcyd = result.response[cntElements - 2].split('-');
        result.wcyd = wcyd;
    }

    return wcyd;
}

/**
 * @param {string array} result   - Command response from remote server
 * @return {object array}         - Array with remote variable objects
 */
Client.prototype.parseVariableList = function (result) {
    let variables = {};
    variables.varArray = [];
    let cntElements = result.response.length;
    if (result.response.length &&
        (result.command === 'VARIABLE LIST') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        result.response.pop(); // remove '+OK'
        // Get count
        variables.count = parseInt(result.response[0]);
        result.response.shift();
        result.response.forEach((item) => {
            let items = item.split(';');
            let obj = {};
            obj.index = parseInt(items[0]);
            obj.name = items[1];
            obj.type = parseInt(items[2]);
            obj.owner = parseInt(items[3]);
            obj.rights = parseInt(items[4]);
            obj.bPersistent = (/true/i).test(items[5]);
            obj.last = new Date(items[6]);

            variables.varArray.push(obj);
        });

        result.variables = variables;
    }

    return variables;
}

/**
 * Parse remote server variable
 *
 * @param {string array} result   - Command response from remote server
 * @return {object}               - Remote variable object
 */
Client.prototype.parseVariable = function (result) {
    let variable = {};
    variable.value = variable.note = "";
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'VARIABLE READ') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        let varArray = result.response[cntElements - 2].split(';');
        variable.name = varArray[0];
        variable.type = parseInt(varArray[1]);
        variable.user = parseInt(varArray[2]);
        variable.rights = parseInt(varArray[3]);
        variable.bPersistent = (/true/i).test(varArray[4]);
        variable.last = new Date(varArray[5]);
        variable.value = vscp.b64DecodeUnicode(varArray[6]);
        // Note my not be present
        if (varArray.length > 7) {
            variable.note = vscp.b64DecodeUnicode(varArray[7]);
        }
        result.variable = variable;
    }

    return variable;
}

/**
 * Parse remote server value
 *
 * @param {string array} result     - Command response from remote server
 * @param {string} cmd              - Command string
 * @return {string}                 - Remote variable value on string form
 */
Client.prototype.parseVariableValue = function (result, cmd) {
    let value = '';
    let cntElements = result.response.length;
    console.log(cmd.toUpperCase());
    if ((result.response.length >= 2) &&
        (result.command === cmd.toUpperCase()) &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        value = vscp.b64DecodeUnicode(result.response[cntElements - 2]);
        result.value = value;
    }

    return value;
}

/**
 * Parse remote server note
 *
 * @param {string array} result   - Command response from remote server
 * @return {string}               - Remote variable note
 */
Client.prototype.parseVariableNote = function (result) {
    let note = '';
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'VARIABLE READNOTE') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        note = vscp.b64DecodeUnicode(result.response[cntElements - 2]);
        result.note = note;
    }

    return note;
}

/**
 * Parse remote variable length
 *
 * @param {string array} result   - Command response from remote server
 * @return {number}               - Remote variable length
 */
Client.prototype.parseVariableLength = function (result) {
    let length = 0;
    let cntElements = result.response.length;
    if ((result.response.length >= 2) &&
        (result.command === 'VARIABLE LENGTH') &&
        (result.response[cntElements - 1]).substr(0, 3) === '+OK') {
        length = parseInt(result.response[cntElements - 2]);
        result.length = length;
    }

    return length;
}


/**
 * Add an event listener.
 *
 * @param {function} eventListener - Event listener function
 */
Client.prototype.addEventListener = function (eventListener) {
    if ("function" === typeof eventListener) {
        this.onEvent.push(eventListener);
    }
};

/**
 * Remove an event listener.
 *
 * @param {function} eventListener - Event listener function
 */
Client.prototype.removeEventListener = function (eventListener) {
    var index = 0;

    for (index = 0; index < this.onEvent.length; ++index) {
        if (this.onEvent[index] === eventListener) {
            this.onEvent.splice(index, 1);
        }
    }
};

/**
 * This function is called for any VSCP server response message
 * and handle and parse response from the server until a line with
 * either +OK or -OK is found. If a receive loop
 * is active events are fired as they come in.
 *
 * @param {string} chunk - VSCP server response chunk
 */
Client.prototype.onSrvResponse = function (chunk) {

    var responseList = [];

    this.collectedData += chunk.toString();

    /* Send message to application. If the application handled the message,
     * nothing more to do. Otherwise the message will be handled now.
     */
    if (false === this._signalMessage(chunk)) {

        // Command response?
        // Save lines up to +OK/-OK
        if (this.state === this.states.CONNECTED) {

            let posOk, posEnd;

            // Positive response? ("+OK ......\r\n")
            if (-1 !== (posOk = this.collectedData.search("\\+OK"))) {

                lastPart = this.collectedData.substring(posOk);
                //console.log('lastPart = [' + lastPart + ']');
                if (-1 !== (posEnd = lastPart.search("\r\n"))) {
                    //console.log(posOk,posEnd);
                    response = this.collectedData.substring(0, posOk) +
                        lastPart.substring(0, posEnd + 2);
                    //console.log('response = [' + response + ']');
                    lastPart = this.collectedData.substring(posOk + posEnd + 2);
                    //console.log('lastPart = [' + lastPart + ']');

                    // save remaining part of server response for further processing
                    this.collectedData = this.collectedData.substring(posOk + 2 + posEnd + 2);
                    responseList = response.split("\r\n");
                    responseList.pop(); // Remove last ('\r\n')
                    //console.log(responseList);
                    this._signalSuccess(
                        {
                            command: this.cmdQueue[0].command,
                            argument: this.cmdQueue[0].argument,
                            response: responseList
                        });
                }
            } else if (-1 !== (posOk = this.collectedData.search("\\-OK"))) {
                lastPart = this.collectedData.substring(posOk);
                //console.log('lastPart = [' + lastPart + ']');
                if (-1 !== (posEnd = lastPart.search("\r\n"))) {
                    //console.log(posOk,posEnd);
                    response = this.collectedData.substring(0, posOk) +
                        lastPart.substring(0, posEnd + 2);
                    //console.log('response = [' + response + ']');
                    lastPart = this.collectedData.substring(posOk + posEnd + 2);
                    //console.log('lastPart = [' + lastPart + ']');
                    // save remaining part of server response for further processing
                    this.collectedData = this.collectedData.substring(posOk + 2 + posEnd + 2);
                    responseList = response.split("\r\n");
                    responseList.pop();
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

            responseList = chunk.toString().split("\r\n");
            responseList.pop(); // Remove last CR LF pair

            for (let idx = 0; idx < responseList.length; idx++) {

                //console.log("[" + responseList[idx] + "]");

                if ('+OK' !== responseList[idx]) {

                    let offset = 0;
                    eventItems = responseList[idx].split(',');
                    let evt = new vscp.Event({ vscpHead: 0 });

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
            onSuccess, onError,
            resolve, reject);
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
 *                                            successful operation
 * @param {function} [options.onError]      - Function which is called on a
 *                                            failed operation
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
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */
Client.prototype.noop = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "noop",
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};

/**
 * Send 'user' command.
 *
 * @param {object} options               - Options
 * @param {string} options.username      - Valid username for account
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */
Client.prototype.user = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" === typeof options) {
        console.error(vscp.getTime() + " Options are missing.");
        reject(Error("Options are missing."));
        return;
    }

    if ("string" !== typeof options.username) {
        console.error(vscp.getTime() + " Username is missing.");
        reject(Error("Usernme is missing."));
        return;
    }
    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "user",
            argument: options.username,
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};

/**
 * Send 'password' command.
 *
 * @param {object} options               - Options
 * @param {string} options.password      - Valid password for account
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */
Client.prototype.password = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" === typeof options) {
        console.error(vscp.getTime() + " Options are missing.");
        reject(Error("Options are missing."));
        return;
    }

    if ("string" !== typeof options.password) {
        console.error(vscp.getTime() + " Password is missing.");
        reject(Error("Password is missing."));
        return;
    }

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "pass",
            argument: options.password,
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};

/**
 * Send 'quit' command.
 *
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {boolean} Result object
 */
Client.prototype.quit = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "quit",
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};

/**
 * Send 'challenge' command.
 *
 * @param {object} options               - Options
 * @param {string} options.password      - Valid password for account
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {string} Challenge string
 */
Client.prototype.challenge = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" === typeof options) {
        console.error(vscp.getTime() + " Options are missing.");
        reject(Error("Options are missing."));
        return;
    }

    if ("string" !== typeof options.password) {
        console.error(vscp.getTime() + " Password is missing.");
        reject(Error("Password is missing."));
        return;
    }

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "challenge",
            argument: options.password,
            onSuccess: onSuccess,
            onError: onError,
        });

    return parseChallenge(result);
};

/**
 * Start rcvloop.
 *
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */
Client.prototype.startRcvLoop = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "rcvloop",
            onSuccess: onSuccess,
            onError: onError,
        });

    this.state = this.states.RCVLOOP;
    return result;
};

/**
 * Stop rcvloop.
 *
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */

Client.prototype.stopRcvLoop = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    this.state = this.states.CONNECTED;

    const result = await this.sendCommand(
        {
            command: "quitloop",
            onSuccess: onSuccess,
            onError: onError,
        });


    return result;
};

/**
 * Clear the VSCP event queue on the server side.
 *
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */
Client.prototype.clearQueue = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }
    }

    const result = await this.sendCommand(
        {
            command: "clrall",
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};

/**
 * Get pending event count from servers inqueue.
 *
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object array} Fetched events
 */
Client.prototype.getPendingEventCount = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "chkdata",
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parsePendingEventsCount(result);
};

/**
 * Get remote server version.
 *
 * @param {object} options               - Options
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Remote VSCP server version
 */
Client.prototype.getRemoteVersion = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }
    }

    const result = await this.sendCommand(
        {
            command: "version",
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseRemoteVersion(result);
};

/**
 * Do 'restart' command.
 *
 * @param {object} options               - Options
 * @param {string} options.password      - Valid password for account
 * @param {function} [options.onSuccess] - Function which is called on
 *                                         a successful operation
 * @param {function} [options.onError]   - Function which is called on
 *                                         a failed operation
 * @return {object} Result object
 */

Client.prototype.restart = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" === typeof options) {
        console.error(vscp.getTime() + " Options are missing.");
        reject(Error("Options are missing."));
        return;
    }

    if ("string" !== typeof options.password) {
        console.error(vscp.getTime() + " Password is missing.");
        reject(Error("Password is missing."));
        return;
    }

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "restart",
            argument: options.password,
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};

/**
* Do 'shutdown' command.
*
* @param {object} options               - Options
* @param {string} options.password      - Valid password for account
* @param {function} [options.onSuccess] - Function which is called on
*                                         a successful operation
* @param {function} [options.onError]   - Function which is called on
*                                         a failed operation
* @return {object} Result object
*/
Client.prototype.shutdown = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" === typeof options) {
        console.error(vscp.getTime() + " Options are missing.");
        reject(Error("Options are missing."));
        return;
    }

    if ("string" !== typeof options.password) {
        console.error(vscp.getTime() + " Password is missing.");
        reject(Error("Password is missing."));
        return;
    }

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "shutdown",
            argument: options.password,
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
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
 *                                                    a successful operation
 * @param {function} [options.onError]              - Function which is called on
 *                                                    a failed operation
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

            filterGuid = options.filterGuid;

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
 *                                                    a successful operation
 * @param {function} [options.onError]              - Function which is called on
 *                                                    a failed operation
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

            maskGuid = options.maskGuid;

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
 * @param {object} options                          - Options
 * @param {function} [options.onSuccess]            - Function which is called on
 *                                                    a successful operation
 * @param {function} [options.onError]              - Function which is called on
 *                                                    a failed operation
 * @return {object} interfaces
 */
Client.prototype.getInterfaces = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }
    }

    const result = await this.sendCommand(
        {
            command: "interface list",
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseInterface(result);
};

/**
 * Retrieve events from server.
 *
 * @param {object} [options]              - Options
 * @param {number} [options.count]        - number of events to fetch
 *                                          default: 1, -1 for all
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @return {array} Retrieved VSCP events
 */
Client.prototype.getEvents = async function (options) {

    var count = 1;
    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("number" === typeof options.count) {
            count = options.count;
        }

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "retr",
            argument: count,
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseRetrieveEvents(result);
};

/**
 * Retrieve statistics from server.
 *
 * @param {object} [options]              - Options
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @return {object} Retrieved statistics
 */
Client.prototype.getStatistics = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "stat",
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseStatistics(result);
};

/**
 * Retrieve info from server.
 *
 * @param {object} [options]              - Options
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @return {object} Retrieved info
 */
Client.prototype.getInfo = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "info",
            onSuccess: onSuccess,
            onError: onError,
        });
    return this.parseInfo(result);
};

/**
 * Retrieve channel id from server.
 *
 * @param {object} [options]              - Options
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @return {object} Retrieved channel id
 */
Client.prototype.getChannelID = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }
    }

    const result = await this.sendCommand(
        {
            command: "chid",
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseChid(result);
};

/**
 * Set GUID for channel.
 *
 * @param {object} [options]              - Options
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @param {number[]|string} [options.guid]    - GUID (default: 0)
 *
 * @return {object} Result object
 */
Client.prototype.setGUID = async function (options) {

    let guid = '-';
    var onSuccess = null;
    var onError = null;

    if ("undefined" === typeof options) {
        console.error(vscp.getTime() + " Options is missing.");
        reject(Error("Options is missing."));
        return;
    }

    if (("string" !== typeof options.guid) && !(options.guid instanceof Array)) {
        console.error(vscp.getTime() + " Option 'guid' is missing.");
        reject(Error("Option 'guid' is missing."));
        return;
    }

    if (options.guid instanceof Array) {
        if (16 !== options.filterGuid.length) {
            console.error(vscp.getTime() + " GUID length is invalid.");
            reject(Error("GUID length is invalid."));
            return;
        }

        guid = options.guid;

    } else if ("string" === typeof options.guid) {

        guidArray = vscp.strToGuid(options.guid);
        if (16 !== guidArray.length) {
            console.error(vscp.getTime() + " GUID is invalid.");
            reject(Error("GUID is invalid."));
            return;
        }
    }

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "setguid",
            argument: guid,
            onSuccess: onSuccess,
            onError: onError,
        });
    return result;
};

/**
 * Get GUID for interface.
 *
 * @param {object} [options]              - Options
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @return {object} Result object
 */
Client.prototype.getGUID = async function (options) {

    let guid = [];
    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "getguid",
            onSuccess: onSuccess,
            onError: onError,
        });
    return this.parseGUID(result);
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
    var onSuccess = null;
    var onError = null;

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

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    const result = await this.sendCommand(
        {
            command: "measurement",
            argument: cmdArg,
            onSuccess: onSuccess,
            onError: onError,
        });

    return result;
};


/**
 * Ask remote server for wcyd code
 *
 * @param {object} [options]              - Options
 * @param {function} [options.onSuccess]  - Function which is called on
 *                                          a successful operation
 * @param {function} [options.onError]    - Function which is called on
 *                                          a failed operation
 * @return {object} Result object
 */
Client.prototype.getWhatCanYouDo = async function (options) {

    var onSuccess = null;
    var onError = null;

    if ("undefined" !== typeof options) {

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }

    }

    const result = await this.sendCommand(
        {
            command: "wcyd",
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseWcyd(result);
};


// ----------------------------------------------------------------------------
//                                Variables
// ----------------------------------------------------------------------------

/**
 * List (all) VSCP server variables.
 *
 * @param {object} options                  - Options
 * @param {string} [options.regex]          - Regular expression to filter variables
 * @param {function} [options.onSuccess]    - Function which is called on a successful operation
 * @param {function} [options.onError]      - Function which is called on a failed operation
 *
 * @return {object} Promise
 */
Client.prototype.listVar = async function (options) {

    var onSuccess = null;
    var onError = null;
    var regex = "";

    if ("undefined" !== typeof options) {

        if ("string" === typeof options.regex) {
            regex = options.regex;
        }

        if ("function" === typeof options.onSuccess) {
            onSuccess = options.onSuccess;
        }

        if ("function" === typeof options.onError) {
            onError = options.onError;
        }
    }

    const result = await this.sendCommand(
        {
            command: "variable list",
            argument: regex.toUpperCase(),
            onSuccess: onSuccess,
            onError: onError,
        });

    return this.parseVariableList(result);
};


/**
 * Create/Write a a VSCP remote variable.
 *
 * @param {object} options                      - Options
 * @param {string} options.name                 - Variable name
 * @param {string} options.value                - Variable value
 * @param {number|string} [options.type]        - Variable type (default: string)
 * @param {number} [options.access]             - Variable value (default: 744)
 * @param {number|string} [options.owner]       - Variable owner if (0/'admin' = superuser)
 *                                                  If empty logged in user is used
 * @param {boolean} [options.bPersistent]       - Variable is persistent (true)
 *                                                  or not (false) Default: false
 * @param {string} [options.note]               - Variable note (optional)
 * @param {function} [options.onSuccess]        - Function which is called on
 *                                                  a successful operation
 * @param {function} [options.onError]          - Function which is called on
 *                                                  a failed operation
 *
 * @return {object} Promise
 */
Client.prototype.writeVar = async function (options) {

    let onSuccess = null;
    let onError = null;

    let type = vscp.varTypes.STRING;  // Default type is string
    let typeStr = "";                 // Used if type is given symbolically
    let rights = 0x744;               // Default access rights
    let owner = -1;                   // Use current user
    let ownerStr = "";                // Used if owner is given symbolically
    let bPersistent = false;          // Not persistent
    let note = "";                    // No note
    let value = "";                   // Empty value

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
    else if ("string" === typeof options.type) {
        typeStr = options.type;
    }

    if ("number" === typeof options.rights) {
        accessrights = options.rights;
    }

    if ("number" === typeof options.owner) {
        owner = options.owner;
    }
    else if ("string" === typeof options.owner) {
        ownerStr = options.owner;
    }

    if ("string" === typeof options.bPersistent) {
        bPersistent = (/true/i).test(options.bPersistent)
    }
    else if ("boolean" === typeof options.bPersistent) {
        bPersistent = options.bPersistent;
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

    let argument = options.name + ';';

    if (typeStr.length) {
        // symbolic type
        argument += typeStr + ';';
    }
    else {
        // type id
        argument += type.toString() + ';';
    }

    argument += (bPersistent ? 1 : 0) + ';';

    if ((-1 === owner) && (0 === ownerStr.length)) {
        // Use logged in user
        argument += ';';
    }
    else if (ownerstr.length) {
        // Symbolic user
        argument += ownerstr + ';';
    }
    else {
        // User if
        argument += owner.toString() + ';';
    }

    argument += rights.toString() + ';';
    argument += vscp.b64EncodeUnicode(value) + ';';
    argument += vscp.b64EncodeUnicode(note) + ';';

    const result = await this.sendCommand(
        {
            command: "variable write",
            argument: argument,
            onSuccess: onSuccess,
            onError: onError,
        });

    return true;
};

/**
 * Read a variable from a VSCP server variable.
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
Client.prototype.readVar = async function (options) {

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

    const result = await this.sendCommand({
        command: "variable read",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError
    });

    return this.parseVariable(result);
};

/**
 * Read a variable value from a VSCP server variable.
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
Client.prototype.readVarValue = async function (options) {

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

    const result = await this.sendCommand({
        command: "variable readvalue",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError
    });

    return this.parseVariableValue(result, "variable readvalue");
};

/**
 * Write variable value to a VSCP server variable.
 *
 * @param {object} options                  - Options
 * @param {string} options.name             - Variable name
 * @param {string} options.value            - Variable value
 * @param {function} [options.onSuccess]    - Function which is called on a
 *                                              successful operation
 * @param {function} [options.onError]      - Function which is called on a
 *                                              failed operation
 *
 * @return {object} Promise
 */
Client.prototype.writeVarValue = async function (options) {

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

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    let result = await this.sendCommand({
        command: "variable writevalue",
        argument: options.name + " " + vscp.b64EncodeUnicode(value),
        onSuccess: onSuccess,
        onError: onError,
    });

    return result;
};



/**
     * Read a variable note from a VSCP server variable.
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
Client.prototype.readVarNote = async function (options) {

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

    const result = await this.sendCommand({
        command: "variable readvalue",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError
    });

    return this.parseVariableNote(result);
};

/**
 * Write variable note to a VSCP server variable.
 *
 * @param {object} options                  - Options
 * @param {string} options.name             - Variable name
 * @param {string} options.note             - Variable note
 * @param {function} [options.onSuccess]    - Function which is called on a
 *                                              successful operation
 * @param {function} [options.onError]      - Function which is called on a
 *                                              failed operation
 *
 * @return {object} Promise
 */
Client.prototype.writeVarNote = async function (options) {

    var onSuccess = null;
    var onError = null;
    var note = "";

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

    if ("string" !== typeof options.note) {
        note = options.note;
    }
    else {
        console.error(vscp.getTime() + " Option 'note' is missing.");
        reject(Error("Option 'note' is missing."));
        return;
    }

    if ("function" === typeof options.onSuccess) {
        onSuccess = options.onSuccess;
    }

    if ("function" === typeof options.onError) {
        onError = options.onError;
    }

    let result = await this.sendCommand({
        command: "variable writenote",
        argument: options.name + " " + vscp.b64EncodeUnicode(note),
        onSuccess: onSuccess,
        onError: onError,
    });

    return result;
};

/**
 * Read a remote variable value and reset the value.
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
Client.prototype.readVarValueReset = async function (options) {

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

    const result = await this.sendCommand({
        command: "variable readreset",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError
    });

    return this.parseVariableValue(result, "variable readreset");
};

/**
 * Read a remote variable value and delete the variable
 *
 * @param {object} options                  - Options
 * @param {string} options.name             - Variable name
 * @param {function} [options.onSuccess]    - Function which is called on a
 *                                            successful operation
 * @param {function} [options.onError]      - Function which is called on a
 *                                            failed operation
 *
 * @return {object} Promise
 */
Client.prototype.readVarDelete = async function (options) {

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

    const result = await this.sendCommand({
        command: "variable readremove",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError
    });

    return this.parseVariableValue(result, "variable readremove");
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
Client.prototype.resetVar = async function (options) {

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

    let result = await this.sendCommand({
        command: "variable reset",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError,

    });

    return result;
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
Client.prototype.removeVar = async function (options) {

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

    let result = await this.sendCommand({
        command: "variable remove",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError,
    });

    return result;
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
Client.prototype.lengthVar = async function (options) {

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

    let result = await this.sendCommand({
        command: "variable length",
        argument: options.name,
        onSuccess: onSuccess,
        onError: onError,
    });

    return parseVariableLength(result);
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
            command: "variable last",
            data: options.name,
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
