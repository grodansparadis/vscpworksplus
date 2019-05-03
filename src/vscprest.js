// VSCP REST API javascript library
// Copyright (c) 2017 Andreas Merkle
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

/* eslint-env jquery */

/** The VSCP client class handles the basic REST api of the VSCP daemon.
 * The function interface uses jquery ajax call in the background and will
 * return a Promise.
 *
 * @class
 * @param {string}      config                  - Configuration
 * @param {string}      [config.baseUrl]        - VSCP daemon URL (protocol + hostname + port)
 * @param {string}      [options.pathPrefix]    - Path prefix (default: '/vscp'), which comes right after the base url.
 * @param {string}      [options.apiVersion]    - API version (for future use)
 */
module.exports = Client = function(config) {

    /** Base URL
     * @member {string}
     */
    this.baseUrl = 'http://localhost:8884';

    /** Path prefix
     * @member {string}
     */
    this.pathPrefix = '/vscp';

    /** REST API version (future use)
     * @member {string}
     */
    this.apiVersion = '';

    /** Session key
     * @member {string}
     */
    this.sessionKey = '';

    if ("undefined" !== typeof config) {

        if ("string" === typeof config.baseUrl) {
            this.baseUrl = config.baseUrl;
        }

        if ("string" === typeof config.pathPrefix) {
            this.pathPrefix = config.pathPrefix;
        }

        if ("number" === typeof config.apiVersion) {
            this.apiVersion = config.apiVersion;
        }
    }

    /** Build complete URL, including command path.
     *
     * @private
     * @param {string} path - Relative command path, after REST API version.
     * @return URL
     */
    this._buildUrl = function(path) {
        var apiBasePath = this.pathPrefix + '/rest'; // In the future: '/rest/api';
        var version = (0 < this.apiVersion) ? ('/' + this.apiVersion) : '';
        var requestUrl = this.baseUrl + apiBasePath + version + path;
        return decodeURIComponent(requestUrl);
    };

    /** Make a request to VSCP daemon via REST api.
     * The onSuccess and onError function parameter are harmonized here.
     * This makes it easier to process them further.
     *
     * @private
     * @param {object}      options             - Options
     * @param {string}      options.path        - Relative path
     * @param {string[]}    options.parameter   - Array of URL parameter
     * @param {string}      options.type        - 'GET', 'POST', or etc.
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this._makeRequest = function(options) {
        return new Promise(function(resolve, reject) {
            var url = this._buildUrl(options.path);
            var index = 0;

            if ("undefined" === typeof options) {
                console.error(vscp.utility.getTime() + " Options are missing.");
                reject(Error("Options are missing."));
                return;
            }

            if ("string" !== typeof options.path) {
                console.error(vscp.utility.getTime() + " Path is missing.");
                reject(Error("Path is missing."));
                return;
            }

            if (false === (options.parameter instanceof Array)) {
                console.error(vscp.utility.getTime() + " Parameter is missing.");
                reject(Error("Parameter is missing."));
                return;
            }

            if ("string" !== typeof options.type) {
                console.error(vscp.utility.getTime() + " Type is missing.");
                reject(Error("Type is missing."));
                return;
            }

            // Add all parameter to URL
            for (index = 0; index < options.parameter.length; ++index) {

                if (0 == index) {
                    url += '?';
                } else {
                    url += '&';
                }

                url += options.parameter[index].name;
                url += '=';
                url += options.parameter[index].value;
            }

            console.debug(vscp.utility.getTime() + " Make request: " + url);

            return $.ajax({
                    url: url,
                    type: options.type,
                    jsonpCallback: 'handler',
                    cache: true,
                    dataType: 'jsonp'
                })
                .then(
                    // On success, manipulate callback and promise data to get harmonized response
                    function(response) {
                        var data = null;

                        // Positive response received from VSCP daemon?
                        if (true === response.success) {
                            data = {
                                success: true,
                                clientError: null,
                                serverError: null,
                                response: response
                            };

                            if ("function" === typeof options.onSuccess) {
                                options.onSuccess(data);
                            }

                            resolve(data);
                            return;
                        }

                        // Negative response received from VSCP daemon
                        data = {
                            success: false,
                            clientError: null,
                            serverError: null,
                            response: response
                        }

                        if ("function" === typeof options.onError) {
                            options.onError(data);
                        }

                        reject(data);
                        return;
                    }.bind(this),
                    // On error, manipulate callback and promise data to get harmonized response
                    function(xhr, status, error) {
                        var data = {
                            success: false,
                            clientError: null,
                            serverError: {
                                xhr: xhr,
                                status: status,
                                error: error
                            },
                            response: null
                        };

                        switch (xhr.readyState) {
                            case 0:
                                console.error(vscp.utility.getTime() + " Ready state = UNSENT");
                                break;
                            case 1:
                                console.error(vscp.utility.getTime() + " Ready state = OPENED");
                                break;
                            case 2:
                                console.error(vscp.utility.getTime() + " Ready state = HEADERS_RECEIVED");
                                break;
                            case 3:
                                console.error(vscp.utility.getTime() + " Ready state = LOADING");
                                break;
                            case 4:
                                console.error(vscp.utility.getTime() + " Ready state = DONE");
                                break;
                            default:
                                console.error(vscp.utility.getTime() + " Ready state = " + xhr.readyState);
                                break;
                        }

                        if ("function" === typeof options.onError) {
                            options.onError(data);
                        }

                        reject(data);
                        return;
                    }.bind(this)
                );
        }.bind(this));
    };

    /** Prepare error object, call error callback and return rejected promise.
     *
     * @private
     * @param {string}      error       - Error description
     * @param {function}    [onError]   - Callback
     *
     * @return {object} Rejected Promise
     */
    this._abort = function(error, onError) {
        return new Promise(function(relsove, reject) {
            var data = {
                success: false,
                clientError: error,
                serverError: null,
                response: null
            };

            if ("function" === typeof onError) {
                onError(data);
            }

            reject(data);
            return;
        });
    };

    /** Open a session.
     *
     * @param {object}      options             - Options
     * @param {string}      options.user        - User name
     * @param {string}      options.password    - Password
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this.openSession = function(options) {

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if ("string" !== typeof options.user) {
            console.error(vscp.utility.getTime() + " User is missing.");
            return this._abort("User is missing.", options.onError);
        }

        if ("string" !== typeof options.password) {
            console.error(vscp.utility.getTime() + " Password is missing.");
            return this._abort("Password is missing.", options.onError);
        }

        console.info(vscp.utility.getTime() + " Open session to " + this.baseUrl + " with " + options.user + ":" + options.password);

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpuser',
                value: options.user
            }, {
                name: 'vscpsecret',
                value: options.password
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'open'
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Session opened: " + data.response.vscpsession);

                // Store session key
                this.sessionKey = data.response.vscpsession;

                if ("function" === typeof options.onSuccess) {
                    options.onSuccess(data);
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to open session: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to open session: " + JSON.stringify(data.serverError));
                }

                if ("function" === typeof options.onError) {
                    options.onError(data);
                }
            }.bind(this)
        });
    };

    /** Close a session.
     *
     * @param {object}      [options]           - Options
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this.closeSession = function(options) {

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            if ("undefined" === typeof options) {
                return this._abort("No session opened.");
            } else {
                return this._abort("No session opened.", options.onError);
            }
        }

        console.info(vscp.utility.getTime() + " Close session '" + this.sessionKey + "' to " + this.baseUrl);

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'close'
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Session closed: " + data.response.vscpsession);

                // Clear session key
                this.sessionKey = '';

                if ("undefined" !== typeof options) {
                    if ("function" === typeof options.onSuccess) {
                        options.onSuccess(data);
                    }
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to close session: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to close session: " + JSON.stringify(data.serverError));
                }

                if ("undefined" !== typeof options) {
                    if ("function" === typeof options.onError) {
                        options.onError(data);
                    }
                }
            }.bind(this)
        });
    };

    /** Get status and how many events are in the queue.
     *
     * @param {object}      [options]           - Options
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this.getStatus = function(options) {

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            if ("undefined" === typeof options) {
                return this._abort("No session opened.");
            } else {
                return this._abort("No session opened.", options.onError);
            }
        }

        console.info(vscp.utility.getTime() + " Get status (" + this.sessionKey + ")");

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'status'
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Get status successful: " + JSON.stringify(data.response));

                if ("undefined" !== typeof options) {
                    if ("function" === typeof options.onSuccess) {
                        options.onSuccess(data);
                    }
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to get status: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to get status: " + JSON.stringify(data.serverError));
                }

                if ("undefined" !== typeof options) {
                    if ("function" === typeof options.onError) {
                        options.onError(data);
                    }
                }
            }.bind(this)
        });
    };

    /** Send a VSCP event.
     *
     * @param {object}      options             - Options
     * @param {object}      options.event       - VSCP event
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this.sendEvent = function(options) {

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
        }

        if (false === options.event instanceof vscp.Event) {
            console.error(vscp.utility.getTime() + " Event is missing.");
            return this._abort("Event is missing.", options.onError);
        }

        console.info(vscp.utility.getTime() + " Send event (" + this.sessionKey + "): " + options.event.getText());

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'sendevent'
            }, {
                name: 'vscpevent',
                value: options.event.getText()
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Event sent.");

                if ("function" === typeof options.onSuccess) {
                    options.onSuccess(data);
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to send event: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to send event: " + JSON.stringify(data.serverError));
                }

                if ("function" === typeof options.onError) {
                    options.onError(data);
                }
            }.bind(this)
        });
    };

    /** Read one or more VSCP events.
     *
     * @param {object}      [options]           - Options
     * @param {object}      [options.count]     - Number of events to read
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this.readEvent = function(options) {

        var count = 1; // One event per default

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            if ("undefined" === typeof options) {
                return this._abort("No session opened.");
            } else {
                return this._abort("No session opened.", options.onError);
            }
        }

        if ("undefined" !== typeof options) {
            if ("number" === typeof options.count) {
                count = options.count;
            }
        }

        console.info(vscp.utility.getTime() + " Read event (" + this.sessionKey + ")");

        return this._makeRequest({
                path: '',
                parameter: [{
                    name: 'vscpsession',
                    value: this.sessionKey
                }, {
                    name: 'format',
                    value: 'jsonp'
                }, {
                    name: 'op',
                    value: 'readevent'
                }, {
                    name: 'count',
                    value: count
                }],
                type: 'GET',
                onSuccess: function(data) {
                    console.info(vscp.utility.getTime() + " Read event successful: " + JSON.stringify(data.response));
                },
                onError: function(data) {
                    if (null !== data.clientError) {
                        console.error(vscp.utility.getTime() + " Failed to read event: " + data.clientError);
                    } else if (null !== data.serverError) {
                        console.error(vscp.utility.getTime() + " Failed to read event: " + JSON.stringify(data.serverError));
                    }
                }
            })
            // Catch VSCP daemon response with event and convert it to vscp.Event objects
            .then(
                // Success
                function(data) {
                    /* eslint-disable no-unused-vars */
                    return new Promise(function(resolve, reject) {
                    /* eslint-enable no-unused-vars */
                        var index = 0;
                        var eventList = [];
                        var event = null;

                        if (null !== data.response) {

                            // Convert REST jsonp event format to vscp.Event format
                            for (index = 0; index < data.response.count; ++index) {
                                event = new vscp.Event({
                                    vscpHead: data.response.event[index].head,
                                    vscpClass: data.response.event[index].vscpClass,
                                    vscpType: data.response.event[index].vscpType,
                                    vscpObId: data.response.event[index].obid,
                                    vscpTimeStamp: data.response.event[index].timestamp,
                                    vscpDateTime: new Date(data.response.event[index].datetime),
                                    vscpGuid: data.response.event[index].guid,
                                    vscpData: data.response.event[index].data
                                });
                                eventList.push(event);
                            }

                            data.response.event = eventList;
                        }

                        if ("undefined" !== typeof options) {
                            if ("function" === typeof options.onSuccess) {
                                options.onSuccess(data);
                            }
                        }

                        resolve(data);
                        return;
                    });
                }.bind(this),
                // Error
                function(data) {
                    return new Promise(function(resolve, reject) {
                        var index = 0;
                        var eventList = [];
                        var event = null;

                        if (null !== data.response) {

                            // Convert REST jsonp event format to vscp.Event format
                            for (index = 0; index < data.response.count; ++index) {
                                event = new vscp.Event({
                                    vscpHead: data.response.event[index].head,
                                    vscpClass: data.response.event[index].vscpClass,
                                    vscpType: data.response.event[index].vscpType,
                                    vscpObId: data.response.event[index].obid,
                                    vscpTimeStamp: data.response.event[index].timestamp,
                                    vscpDateTime: new Date(data.response.event[index].datetime),
                                    vscpGuid: data.response.event[index].guid,
                                    vscpData: data.response.event[index].data
                                });
                                eventList.push(event);
                            }

                            data.response.event = eventList;
                        }

                        if ("undefined" !== typeof options) {
                            if ("function" === typeof options.onError) {
                                options.onError(data);
                            }
                        }

                        reject(data);
                        return;
                    });
                }.bind(this)
            );
    };

    /** Set filter.
     *
     * @param {object}          options                     - Options
     * @param {number}          [options.filterPriority]    - Priority filter
     * @param {number}          [options.filterClass]       - Class filter
     * @param {number}          [options.filterType]        - Type filter
     * @param {number[]|string} [options.filterGuid]        - GUID filter
     * @param {number}          [options.maskPriority]      - Priority mask
     * @param {number}          [options.maskClass]         - Class mask
     * @param {number}          [options.maskType]          - Type mask
     * @param {number[]|string} [options.maskGuid]          - GUID mask
     * @param {function}        [options.onSuccess]         - Function which is called on a successful operation
     * @param {function}        [options.onError]           - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    this.setFilter = function(options) {

        var filter = "";
        var filterPriority = 0;
        var filterClass = 0;
        var filterType = 0;
        var filterGuid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        var mask = "";
        var maskPriority = 0;
        var maskClass = 0xffff;
        var maskType = 0xffff;
        var maskGuid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
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
                return this._abort("GUID filter length is invalid.");
            }

            filterGuid = options.filterGuid;
        } else if ("string" === typeof options.filterGuid) {

            filterGuid = vscp.utility.strToGuid(options.filterGuid);

            if (16 !== filterGuid.length) {
                console.error(vscp.utility.getTime() + " GUID filter is invalid.");
                return this._abort("GUID filter is invalid.");
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
                return this._abort("GUID mask length is invalid.");
            }

            maskGuid = options.maskGuid;
        } else if ("string" === typeof options.maskGuid) {

            maskGuid = vscp.utility.strToGuid(options.maskGuid);

            if (16 !== maskGuid.length) {
                console.error(vscp.utility.getTime() + " GUID mask is invalid.");
                return this._abort("GUID mask is invalid.");
            }
        }

        filter += "0x" + filterPriority.toString(16) + ",";
        filter += "0x" + filterClass.toString(16) + ",";
        filter += "0x" + filterType.toString(16) + ",";

        filter += vscp.utility.guidToStr(filterGuid);

        mask += "0x" + maskPriority.toString(16) + ",";
        mask += "0x" + maskClass.toString(16) + ",";
        mask += "0x" + maskType.toString(16) + ",";

        mask += vscp.utility.guidToStr(maskGuid);

        console.info(vscp.utility.getTime() + " Set filter (" + this.sessionKey + "): filter = " + filter + ", mask = " + mask);

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'setfilter'
            }, {
                name: 'vscpfilter',
                value: filter
            }, {
                name: 'vscpmask',
                value: mask
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Filter set.");

                if ("function" === typeof options.onSuccess) {
                    options.onSuccess(data);
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to set filter: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to set filter: " + JSON.stringify(data.serverError));
                }

                if ("function" === typeof options.onError) {
                    options.onError(data);
                }
            }.bind(this)
        });
    };

    /** Clear the VSCP event queue on the server side.
     *
     * @param {object}      [options]           - Options
     * @param {function}    [options.onSuccess] - Callback, which is called for successful request.
     * @param {function}    [options.onError]   - Callback, which is called for failed request.
     *
     * @return {object} Promise
     */
    this.clearQueue = function(options) {

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            if ("undefined" === typeof options) {
                return this._abort("No session opened.");
            } else {
                return this._abort("No session opened.", options.onError);
            }
        }

        console.info(vscp.utility.getTime() + " Clear queue (" + this.sessionKey + ")");

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'clearqueue'
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Clear queue successful: " + JSON.stringify(data.response));

                if ("undefined" !== typeof options) {
                    if ("function" === typeof options.onSuccess) {
                        options.onSuccess(data);
                    }
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to clear queue: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to clear queue: " + JSON.stringify(data.serverError));
                }

                if ("undefined" !== typeof options) {
                    if ("function" === typeof options.onError) {
                        options.onError(data);
                    }
                }
            }.bind(this)
        });
    };

    /**
     * Create a a VSCP remote variable.
     *
     * @param {object}      options                 - Options
     * @param {string}      options.name            - Variable name
     * @param {number}      [options.type]          - Variable type (default: string)
     * @param {number}      [options.accessrights]  - Variable value (default: 744)
     * @param {boolean}     options.persistency     - Variable is persistent (true) or not (false)
     * @param {string}      options.value           - Variable Value
     * @param {string}      [options.note]          - Variable note (optional)
     * @param {function}    [options.onSuccess]     - Function which is called on a successful operation
     * @param {function}    [options.onError]       - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    this.createVar = function(options) {

        var type = vscp.constants.varTypes.STRING; // Default type is string
        var accessrights = 744; // Default access rights
        var persistency = false; // Not persistent
        var note = ""; // No note
        var value = "";

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
        }

        if ("string" !== typeof options.name) {
            console.error(vscp.utility.getTime() + " Option 'name' is missing.");
            return this._abort("Option 'name' is missing.", options.onError);
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
            } else {
                persistency = true;
            }
        } else if ("boolean" === typeof options.persistency) {
            persistency = options.persistency;
        } else {
            console.error(vscp.utility.getTime() + " Option 'persistency' is missing.");
            return this._abort("Option 'persistency' is missing.", options.onError);
        }

        if ("string" !== typeof options.value) {
            value = options.value;
        } else if ("number" !== typeof options.value) {
            value = options.value.toString();
        } else if ("boolean" !== typeof options.value) {
            value = (options.value ? "true" : "false");
        } else {
            console.error(vscp.utility.getTime() + " Option 'value' is missing.");
            return this._abort("Option 'value' is missing.", options.onError);
        }

        if ("string" === typeof options.note) {
            note = options.note;
        }

        console.info(vscp.utility.getTime() + " Create variable (" + this.sessionKey + ")");

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'createvar'
            }, {
                name: 'variable',
                value: options.name
            }, {
                name: 'type',
                value: type
            }, {
                name: 'accessright',
                value: accessrights
            }, {
                name: 'persistent',
                value: persistency
            }, {
                name: 'value',
                value: vscp.encodeValueIfBase64(type, value)
            }, {
                name: 'note',
                value: vscp.b64EncodeUnicode(note)
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Variable created: " + JSON.stringify(data.response));

                if ("function" === typeof options.onSuccess) {
                    options.onSuccess(data);
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to create variable: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to create variable: " + JSON.stringify(data.serverError));
                }

                if ("function" === typeof options.onError) {
                    options.onError(data);
                }
            }.bind(this)
        });
    };

    /**
     * Read a value from a VSCP server variable.
     *
     * @param {object}      options             - Options
     * @param {string}      options.name        - Variable name
     * @param {function}    [options.onSuccess] - Function which is called on a successful operation
     * @param {function}    [options.onError]   - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    this.readVar = function(options) {

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
        }

        if ("string" !== typeof options.name) {
            console.error(vscp.utility.getTime() + " Option 'name' is missing.");
            return this._abort("Option 'name' is missing.", options.onError);
        }

        console.info(vscp.utility.getTime() + " Read variable (" + this.sessionKey + ")");

        return this._makeRequest({
                path: '',
                parameter: [{
                    name: 'vscpsession',
                    value: this.sessionKey
                }, {
                    name: 'format',
                    value: 'jsonp'
                }, {
                    name: 'op',
                    value: 'readvar'
                }, {
                    name: 'variable',
                    value: options.name
                }],
                type: 'GET',
                onSuccess: function(data) {
                    console.info(vscp.utility.getTime() + " Variable read: " + JSON.stringify(data.response));
                },
                onError: function(data) {
                    if (null !== data.clientError) {
                        console.error(vscp.utility.getTime() + " Failed to read variable: " + data.clientError);
                    } else if (null !== data.serverError) {
                        console.error(vscp.utility.getTime() + " Failed to read variable: " + JSON.stringify(data.serverError));
                    }
                }
            })
            // Catch VSCP daemon response and convert base64 encoded stuff back to string and other things
            .then(
                // Success
                function(data) {
                    /* eslint-disable no-unused-vars */
                    return new Promise(function(resolve, reject) {
                    /* eslint-enable no-unused-vars */

                        if (null !== data.response) {
                            data.response.varvalue = vscp.decodeValueIfBase64(data.response.vartypecode, data.response.varvalue);
                            data.response.varnote = vscp.b64DecodeUnicode(data.response.varnote);
                        }

                        if ("function" === typeof options.onSuccess) {
                            options.onSuccess(data);
                        }

                        resolve(data);
                        return;
                    });
                }.bind(this),
                // Error
                function(data) {
                    return new Promise(function(resolve, reject) {

                        if (null !== data.response) {
                            data.response.varvalue = vscp.decodeValueIfBase64(data.response.vartypecode, data.response.varvalue);
                            data.response.varnote = vscp.b64DecodeUnicode(data.response.varnote);
                        }

                        if ("function" === typeof options.onError) {
                            options.onError(data);
                        }

                        reject(data);
                        return;
                    });
                }.bind(this)
            );
    };

    /**
     * Write a value to a VSCP server variable.
     *
     * @param {object} options                  - Options
     * @param {string} options.name             - Variable name
     * @param {string} options.value            - Variable value
     * @param {number} options.type             - Variable type
     * @param {function} [options.onSuccess]    - Function which is called on a successful operation
     * @param {function} [options.onError]      - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    this.writeVar = function(options) {

        var value = "";

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
        }

        if ("string" !== typeof options.name) {
            console.error(vscp.utility.getTime() + " Option 'name' is missing.");
            return this._abort("Option 'name' is missing.", options.onError);
        }

        if ("string" !== typeof options.value) {
            value = options.value;
        } else if ("number" !== typeof options.value) {
            value = options.value.toString();
        } else if ("boolean" !== typeof options.value) {
            value = (options.value ? "true" : "false");
        } else {
            console.error(vscp.utility.getTime() + " Option 'value' is missing.");
            return this._abort("Option 'value' is missing.", options.onError);
        }

        if ("number" !== typeof options.type) {
            console.error(vscp.utility.getTime() + " Option type is missing.");
            return this._abort("Option type is missing.", options.onError);
        }

        console.info(vscp.utility.getTime() + " Write variable (" + this.sessionKey + ")");

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'writevar'
            }, {
                name: 'variable',
                value: options.name
            }, {
                name: 'value',
                value: vscp.encodeValueIfBase64(options.type, value)
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Variable written: " + JSON.stringify(data.response));

                if ("function" === typeof options.onSuccess) {
                    options.onSuccess(data);
                }
            }.bind(this),
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to write variable: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to write variable: " + JSON.stringify(data.serverError));
                }

                if ("function" === typeof options.onError) {
                    options.onError(data);
                }
            }.bind(this)
        });
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
    this.removeVar = function(options) {

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
        }

        if ("string" !== typeof options.name) {
            console.error(vscp.utility.getTime() + " Option 'name' is missing.");
            return this._abort("Option 'name' is missing.", options.onError);
        }

        console.info(vscp.utility.getTime() + " Remove variable (" + this.sessionKey + ")");

        return this._makeRequest({
            path: '',
            parameter: [{
                name: 'vscpsession',
                value: this.sessionKey
            }, {
                name: 'format',
                value: 'jsonp'
            }, {
                name: 'op',
                value: 'deletevar'
            }, {
                name: 'variable',
                value: options.name
            }],
            type: 'GET',
            onSuccess: function(data) {
                console.info(vscp.utility.getTime() + " Variable removed: " + JSON.stringify(data.response));

                if ("function" === typeof options.onSuccess) {
                    options.onSuccess(data);
                }
            },
            onError: function(data) {
                if (null !== data.clientError) {
                    console.error(vscp.utility.getTime() + " Failed to remove variable: " + data.clientError);
                } else if (null !== data.serverError) {
                    console.error(vscp.utility.getTime() + " Failed to remove variable: " + JSON.stringify(data.serverError));
                }

                if ("function" === typeof options.onError) {
                    options.onError(data);
                }
            }
        });
    };

    /**
     * List all VSCP server variables.
     *
     * @param {object}      options             - Options
     * @param {boolean}     options.listLong    - When false the variable list dos not include value and note. If set to true value and note is included.
     * @param {string}      [options.regex]     - Regular expression to filter variables
     * @param {function}    [options.onSuccess] - Function which is called on a successful operation
     * @param {function}    [options.onError]   - Function which is called on a failed operation
     *
     * @return {object} Promise
     */
    this.listVar = function(options) {

        var regex = "";

        if ("undefined" === typeof options) {
            console.error(vscp.utility.getTime() + " Options are missing.");
            return this._abort("Options are missing.");
        }

        if (0 === this.sessionKey.length) {
            console.error(vscp.utility.getTime() + " No session opened.");
            return this._abort("No session opened.", options.onError);
        }

        if ("boolean" !== typeof options.listLong) {
            console.error(vscp.utility.getTime() + " Option listLong is missing.");
            return this._abort("Option listLong is missing.");
        }

        if ("string" === typeof options.regex) {
            regex = options.regex;
        }

        console.info(vscp.utility.getTime() + " List variables (" + this.sessionKey + ")");

        return this._makeRequest({
                path: '',
                parameter: [{
                    name: 'vscpsession',
                    value: this.sessionKey
                }, {
                    name: 'format',
                    value: 'jsonp'
                }, {
                    name: 'op',
                    value: 'listvar'
                }, {
                    name: 'listlong',
                    value: options.listLong
                }, {
                    name: 'regex',
                    value: encodeURIComponent(regex)
                }],
                type: 'GET',
                onSuccess: function(data) {
                    console.info(vscp.utility.getTime() + " Variables listed: " + JSON.stringify(data.response));
                },
                onError: function(data) {
                    if (null !== data.clientError) {
                        console.error(vscp.utility.getTime() + " Failed to list variables: " + data.clientError);
                    } else if (null !== data.serverError) {
                        console.error(vscp.utility.getTime() + " Failed to list variables: " + JSON.stringify(data.serverError));
                    }
                }
            })
            // Catch VSCP daemon response and convert base64 encoded stuff back to string and other things
            .then(
                // Successful
                function(data) {
                    /* eslint-disable no-unused-vars */
                    return new Promise(function(resolve, reject) {
                    /* eslint-enable no-unused-vars */
                        var index = 0;

                        if (null !== data.response) {
                            for (index = 0; index < data.response.count; ++index) {
                                if ("string" === typeof data.response.variable[index].varvalue) {
                                    data.response.variable[index].varvalue = vscp.decodeValueIfBase64(data.response.variable[index].vartypecode, data.response.variable[index].varvalue);
                                }

                                if ("string" === typeof data.response.variable[index].varnote) {
                                    data.response.variable[index].varnote = vscp.b64DecodeUnicode(data.response.variable[index].varnote);
                                }
                            }
                        }

                        if ("function" === typeof options.onSuccess) {
                            options.onSuccess(data);
                        }

                        resolve(data);
                        return;
                    });
                }.bind(this),
                // Error
                function(data) {
                    return new Promise(function(resolve, reject) {
                        var index = 0;

                        if (null !== data.response) {
                            for (index = 0; index < data.response.count; ++index) {
                                if ("string" === typeof data.response.variable[index].varvalue) {
                                    data.response.variable[index].varvalue = vscp.decodeValueIfBase64(data.response.variable[index].vartypecode, data.response.variable[index].varvalue);
                                }

                                if ("string" === typeof data.response.variable[index].varnote) {
                                    data.response.variable[index].varnote = vscp.b64DecodeUnicode(data.response.variable[index].varnote);
                                }
                            }
                        }

                        if ("function" === typeof options.onError) {
                            options.onError(data);
                        }

                        reject(data);
                        return;
                    });
                }.bind(this)
            );
    };
}