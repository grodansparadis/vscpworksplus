// VSCP widget javascript library
//
// Copyright (c) 2015-2019 Andreas Merkle
// <vscp@blue-andi.de>
//
// Licence:
// The MIT License (MIT)
// [OSI Approved License]
//
// The MIT License (MIT)
//
// Copyright © 2012-2020 Ake Hedman, Grodans Paradis AB (Paradise of the Frog)
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

/*jshint bitwise: false */
/* eslint-env jquery */

/* Create the root namespace and making sure we're not overwriting it */
var vscp = vscp || {};

/* ---------------------------------------------------------------------- */

/**
 * VSCP widgets
 * @namespace vscp.widget
 */
vscp._createNS("vscp.widget");

/**
 * Generate a UUID.
 *
 * @return {string} UUID
 */
vscp.widget.generateUUID = function() {

    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = (c === 'x') ? r : ((r & 0x03) | 0x08);
        return v.toString(16);
    });

    return uuid;
};

/**
 * Add a image to the canvas.
 *
 * @param {object} options              - Options
 * @param {string} options.canvasName   - Name of the canvas, normally the canvas id
 * @param {string} options.url          - Path to the image
 * @param {number} options.x            - x position of the image in the canvas
 * @param {number} options.y            - y position of the image in the canvas
 */
vscp.widget.Image = function(options) {

    this.canvasName = "canvas";
    this.url = "";
    this.x = 0;
    this.y = 0;
    this._id = vscp.widget.generateUUID(); // Id used to identify the layer

    if ("undefined" !== typeof options) {
        if ("string" === typeof options.canvasName) {
            this.canvasName = options.canvasName;
        }
        if ("string" === typeof options.url) {
            this.url = options.url;
        }
        if ("number" === typeof options.x) {
            this.x = options.x;
        }
        if ("number" === typeof options.y) {
            this.y = options.y;
        }
    }

    $(this.canvasName).drawImage({
            name: this._id, // Layer name
            layer: true, // Create layer
            source: this.url, // Image path
            x: this.x, // x position in the canvas
            y: this.y, // y position in the canvas
            fromCenter: false // Coordinates origin is in the upper left corner
        })
        .drawLayers();
};

/**
 * A button widget.
 * @class
 *
 * @param {object} options                      - Options
 * @param {string} options.canvasName           - Name of the canvas, normally the canvas id
 * @param {number} options.offImageUrl          - URL to button which is in off state
 * @param {number} options.onImageUrl           - URL to button which is in on state
 * @param {number} options.x                    - x position of the image in the canvas
 * @param {number} options.y                    - y position of the image in the canvas
 * @param {number} [options.scale]              - Scale factor applied to the button image (default: 1.0)
 * @param {vscp.ws.Client} options.client       - VSCP websocket client, used for event communication
 * @param {boolean} [options.bindToRemoteState] - Bind the button state to the remote state or not (default: false)
 * @param {number} [options.receiveZone]        - Zone where state events will come from (default: 255)
 * @param {number} [options.receiveSubZone]     - Sub-zone where state events will come from (default: 255)
 * @param {number} [options.transmitZone]       - Zone where button event will be sent to (default: 255)
 * @param {number} [options.transmitSubZone]    - Sub-zone where button event will be sent to (default: 255)
 * @param {number} [options.index]              - Button index (instance number)  (default: 0)
 * @param {boolean} [options.enable]            - Enable or disable button  (default: false)
 */
vscp.widget.Button = function(options) {

    this.canvasName = "canvas"; // Name of the canvas
    this.offImageUrl = ""; // URL to button which is in off state
    this.onImageUrl = ""; // URL to button which is in on state
    this.x = 0; // x-coordinate in the canvas
    this.y = 0; // y-coordinate in the canvas
    this.scale = 1; // Scale factor
    this._isEnabled = true; // Button is enabled or disabled
    this._idOn = vscp.widget.generateUUID(); // Id used to identify the layer
    this._idOff = vscp.widget.generateUUID(); // Id used to identify the layer
    this._idDisabled = vscp.widget.generateUUID(); // Id used to identify the layer

    this.client = null; // VSCP websocket client
    this.bindToRemoteState = false; // Button state changes only local
    this.index = 0; // Button index (instance number)
    this.receiveZone = 255; // Zone where state events will come from
    this.receiveSubZone = 255; // Sub-zone where state events will come from
    this.transmitZone = 255; // Zone where button event will be sent to
    this.transmitSubZone = 255; // Sub-zone where button event will be sent to
    this._state = false; // Current button state

    if ("undefined" === typeof options) {
        console.error(vscp.utility.getTime() + " Options are missing.");
        return null;
    }

    if ("string" !== typeof options.canvasName) {
        console.error(vscp.utility.getTime() + " Canvas name is missing.");
        return null;
    }

    this.canvasName = options.canvasName;

    if ("string" !== typeof options.offImageUrl) {
        console.error(vscp.utility.getTime() + " Image URL for button in off state is missing.");
        return null;
    }

    this.offImageUrl = options.offImageUrl;

    if ("string" !== typeof options.onImageUrl) {
        console.error(vscp.utility.getTime() + " Image URL for button in on state is missing.");
        return null;
    }

    this.onImageUrl = options.onImageUrl;

    if ("number" !== typeof options.x) {
        console.error(vscp.utility.getTime() + " Image x-coordinate is missing.");
        return null;
    }

    this.x = options.x;

    if ("number" !== typeof options.y) {
        console.error(vscp.utility.getTime() + " Image y-coordinate is missing.");
        return null;
    }

    this.y = options.y;

    if ("number" === typeof options.scale) {
        this.scale = options.scale;
    }

    if ("object" !== typeof options.client) {
        console.error(vscp.utility.getTime() + " VSCP websocket client is missing.");
        return null;
    }

    this.client = options.client;

    if ("boolean" === typeof options.bindToRemoteState) {
        this.bindToRemoteState = options.bindToRemoteState;
    }

    if ("number" === typeof options.transmitZone) {
        this.transmitZone = options.transmitZone;
    }

    if ("number" === typeof options.transmitSubZone) {
        this.transmitSubZone = options.transmitSubZone;
    }

    if ("number" === typeof options.receiveZone) {
        this.receiveZone = options.receiveZone;
    }

    if ("number" === typeof options.receiveSubZone) {
        this.receiveSubZone = options.receiveSubZone;
    }

    if ("number" === typeof options.index) {
        this.index = options.index;
    }

    if ("boolean" === typeof options.enable) {
        this._isEnabled = options.enable;
    }

    // Event listener for VSCP events
    var eventListener = (function(client, evt) {

            if ("undefined" === typeof evt) {
                return;
            }

            if (false === (evt instanceof vscp.Event)) {
                return;
            }

            if (false === this.bindToRemoteState) {
                return;
            }

            if (vscp.constants.classes.VSCP_CLASS1_INFORMATION === evt.vscpClass) {

                if (vscp.constants.types.VSCP_TYPE_INFORMATION_ON === evt.vscpType) {

                    // Zone and sub-zone match?
                    if ((this.receiveZone === evt.vscpData[1]) &&
                        (this.receiveSubZone === evt.vscpData[2])) {

                        this._state = true;
                        this.draw();
                    }
                } else if (vscp.constants.types.VSCP_TYPE_INFORMATION_OFF === evt.vscpType) {

                    // Zone and sub-zone match?
                    if ((this.receiveZone === evt.vscpData[1]) &&
                        (this.receiveSubZone === evt.vscpData[2])) {

                        this._state = false;
                        this.draw();
                    }

                }
            }
        })
        .bind(this);

    /* eslint-disable no-unused-vars */
    var onClick = (function(layer) {
    /* eslint-enable no-unused-vars */

        if (null === this.client) {
            return;
        }

        if (false === this._isEnabled) {
            return;
        }

        if (false === this._state) {

            this.client.sendEvent({

                event: new vscp.Event({
                    vscpClass: vscp.constants.classes.VSCP_CLASS1_CONTROL,
                    vscpType: vscp.constants.types.VSCP_TYPE_CONTROL_TURNON,
                    vscpPriority: vscp.constants.priorities.PRIORITY_3_NORMAL,
                    vscpData: [
                        this.index,
                        this.transmitZone,
                        this.transmitSubZone
                    ]
                }),

                /* eslint-disable no-unused-vars */
                onSuccess: (function(client) {
                /* eslint-enable no-unused-vars */
                    if (false === this.bindToRemoteState) {
                        this._state = true;
                        this.draw();
                    }
                }).bind(this)
            });

        } else {

            this.client.sendEvent({

                event: new vscp.Event({
                    vscpClass: vscp.constants.classes.VSCP_CLASS1_CONTROL,
                    vscpType: vscp.constants.types.VSCP_TYPE_CONTROL_TURNOFF,
                    vscpPriority: vscp.constants.priorities.PRIORITY_3_NORMAL,
                    vscpData: [
                        this.index,
                        this.transmitZone,
                        this.transmitSubZone
                    ]
                }),

                /* eslint-disable no-unused-vars */
                onSuccess: (function(client) {
                /* eslint-enable no-unused-vars */
                    if (false === this.bindToRemoteState) {
                        this._state = false;
                        this.draw();
                    }
                }).bind(this)
            });

        }
    }).bind(this);

    // Register the VSCP event handler
    if ((null !== this.client) &&
        (true === this.bindToRemoteState)) {
        this.client.addEventListener(eventListener);
    }

    /* Create
     * - one layer with the button in off state
     * - one layer with the button in on state
     * - one layer with the disabled sign
     */
    $(this.canvasName)
        .drawImage({
            name: this._idOff,
            source: this.offImageUrl,
            layer: true,
            x: this.x,
            y: this.y,
            scale: this.scale,
            click: onClick,
            visible: true
        })
        .drawImage({
            name: this._idOn,
            source: this.onImageUrl,
            layer: true,
            x: this.x,
            y: this.y,
            scale: this.scale,
            click: onClick,
            visible: false
        })
        .addLayer({
            type: 'function',
            name: this._idDisabled,
            fn: (function() {

                var imageWidth = $(this.canvasName).getLayer(this._idOff).width * this.scale;
                var imageHeight = $(this.canvasName).getLayer(this._idOff).height * this.scale;

                $(this.canvasName)
                    .drawLine({
                        strokeStyle: '#f00',
                        strokeWidth: 2,
                        x1: (this.x - (imageWidth / 2)),
                        y1: (this.y - (imageHeight / 2)),
                        x2: (this.x + (imageWidth / 2)),
                        y2: (this.y + (imageHeight / 2))
                    })
                    .drawLine({
                        strokeStyle: '#f00',
                        strokeWidth: 2,
                        x1: (this.x - (imageWidth / 2)),
                        y1: (this.y + (imageHeight / 2)),
                        x2: (this.x + (imageWidth / 2)),
                        y2: (this.y - (imageHeight / 2))
                    });
            }).bind(this),
            visible: true
        });

    this.draw();
};

/**
 * Draw the button depended on its current state.
 */
vscp.widget.Button.prototype.draw = function() {

    if (false === this._isEnabled) {
        $(this.canvasName).getLayer(this._idOff).visible = true;
        $(this.canvasName).getLayer(this._idOn).visible = false;
        $(this.canvasName).getLayer(this._idDisabled).visible = true;
    } else if (false === this._state) {
        $(this.canvasName).getLayer(this._idOff).visible = true;
        $(this.canvasName).getLayer(this._idOn).visible = false;
        $(this.canvasName).getLayer(this._idDisabled).visible = false;
    } else {
        $(this.canvasName).getLayer(this._idOff).visible = false;
        $(this.canvasName).getLayer(this._idOn).visible = true;
        $(this.canvasName).getLayer(this._idDisabled).visible = false;
    }

    $(this.canvasName).drawLayers();
};

/**
 * Enable or disable the button.
 *
 * @param {boolean} value - Enable (true) or disable (false) it
 */
vscp.widget.Button.prototype.setEnabled = function(value) {

    if ("boolean" !== typeof value) {
        return;
    }

    this._isEnabled = value;
    this.draw();
};

/**
 * A thermometer widget.
 * @class
 *
 * @param {object} options                      - Options
 * @param {string} options.canvasName           - Name of the canvas, normally the canvas id
 * @param {number} options.imageUrl             - URL to thermometer image
 * @param {number} options.x                    - x position of the image in the canvas
 * @param {number} options.y                    - y position of the image in the canvas
 * @param {object} options.data                 - Thermometer data
 * @param {number} options.data.maxT            - Max. temperature in degree celsius
 * @param {number} options.data.minT            - Min. temperature in degree celsius
 * @param {number} options.data.x               - x position of the lower left begin of the thermometer column in image
 * @param {number} options.data.y               - y position of the lower left begin of the thermometer column in image
 * @param {number} options.data.height          - Thermometer column height (only between numbers)
 * @param {number} options.data.width           - Thermometer column width
 * @param {number} options.data.yOffset         - Thermometer column height offset from the begin to the first number
 * @param {string} options.data.color           - HTML color, e.g. '#8A0000'
 * @param {number} [options.scale]              - Scale factor applied to the thermometer image (default: 1.0)
 * @param {vscp.ws.Client} options.client       - VSCP websocket client, used for event communication
 * @param {number} [options.receiveZone]        - Zone where state events will come from (default: 255)
 * @param {number} [options.receiveSubZone]     - Sub-zone where state events will come from (default: 255)
 * @param {number} [options.sensorIndex]        - Sensor index (default: 0)
 * @param {number} [options.vscpClass]          - VSCP measurement class (default: CLASS1.MEASUREMENT)
 * @param {number} [options.vscpType]           - VSCP measurement type (default: CLASS1.MEASUREMENT.TERMPERATURE)
 * @param {boolean} [options.enable]            - Enable or disable thermometer (default: true)
 */
vscp.widget.Thermometer = function(options) {

    this.canvasName = "canvas"; // Name of the canvas
    this.imageUrl = ""; // URL to thermometer image
    this.x = 0; // x-coordinate in the canvas
    this.y = 0; // y-coordinate in the canvas
    this.scale = 1; // Scale factor
    this._isEnabled = true; // Widget is enabled or disabled
    this._idThermometer = vscp.widget.generateUUID(); // Id used to identify the layer
    this._idDisabled = vscp.widget.generateUUID(); // Id used to identify the layer
    this._idData = vscp.widget.generateUUID(); // Id used to identify the layer
    this._temperature = 0; // Temperature
        
    this.client = null; // VSCP websocket client
    this.decoder = null; // VSCP measurement decoder
    this.sensorIndex = -1; // Sensor index (instance number)
    this.vscpClass = vscp.constants.classes.VSCP_CLASS1_MEASUREMENT; // Measurement class
    this.vscpType = vscp.constants.types.VSCP_TYPE_MEASUREMENT_TEMPERATURE; // Measurement type
    this.receiveZone = 255; // Zone where state events will come from
    this.receiveSubZone = 255; // Sub-zone where state events will come from

    // Thermometer data
    this._data = {
        maxT: 0,
        minT: 0,
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        yOffset: 0,
        color: ""
    };

    if ("undefined" === typeof options) {
        console.error(vscp.utility.getTime() + " Options are missing.");
        return null;
    }

    if ("string" !== typeof options.canvasName) {
        console.error(vscp.utility.getTime() + " Canvas name is missing.");
        return null;
    }

    this.canvasName = options.canvasName;

    if ("string" !== typeof options.imageUrl) {
        console.error(vscp.utility.getTime() + " Image URL for thermometer is missing.");
        return null;
    }

    this.imageUrl = options.imageUrl;


    if ("number" !== typeof options.x) {
        console.error(vscp.utility.getTime() + " Image x-coordinate is missing.");
        return null;
    }

    this.x = options.x;

    if ("number" !== typeof options.y) {
        console.error(vscp.utility.getTime() + " Image y-coordinate is missing.");
        return null;
    }

    this.y = options.y;

    if ("object" !== typeof options.data) {
        console.error(vscp.utility.getTime() + " Thermometer data is missing.");
        return null;
    }

    if ("number" !== typeof options.data.maxT) {
        console.error(vscp.utility.getTime() + " Thermometer max. temperature is missing.");
        return null;
    }

    this._data.maxT = options.data.maxT;

    if ("number" !== typeof options.data.minT) {
        console.error(vscp.utility.getTime() + " Thermometer min. temperature is missing.");
        return null;
    }

    this._data.minT = options.data.minT;

    if ("number" !== typeof options.data.x) {
        console.error(vscp.utility.getTime() + " Thermometer column x position is missing.");
        return null;
    }

    this._data.x = options.data.x;

    if ("number" !== typeof options.data.y) {
        console.error(vscp.utility.getTime() + " Thermometer column y position is missing.");
        return null;
    }

    this._data.y = options.data.y;

    if ("number" !== typeof options.data.height) {
        console.error(vscp.utility.getTime() + " Thermometer column height is missing.");
        return null;
    }

    this._data.height = options.data.height;

    if ("number" !== typeof options.data.width) {
        console.error(vscp.utility.getTime() + " Thermometer column width is missing.");
        return null;
    }

    this._data.width = options.data.width;

    if ("number" !== typeof options.data.yOffset) {
        console.error(vscp.utility.getTime() + " Thermometer column offset is missing.");
        return null;
    }

    this._data.yOffset = options.data.yOffset;

    if ("string" !== typeof options.data.color) {
        console.error(vscp.utility.getTime() + " Thermometer column color is missing.");
        return null;
    }

    this._data.color = options.data.color;

    if ("number" === typeof options.scale) {
        this.scale = options.scale;
    }

    if ("object" !== typeof options.client) {
        console.error(vscp.utility.getTime() + " VSCP websocket client is missing.");
        return null;
    }

    this.client = options.client;

    if ("number" === typeof options.receiveZone) {
        this.receiveZone = options.receiveZone;
    }

    if ("number" === typeof options.receiveSubZone) {
        this.receiveSubZone = options.receiveSubZone;
    }

    if ("number" === typeof options.sensorIndex) {
        this.sensorIndex = options.sensorIndex;
    }

    if ("number" === typeof options.vscpClass) {
        this.vscpClass = options.vscpClass;
    }

    if ("number" === typeof options.vscpType) {
        this.vscpType = options.vscpType;
    }

    if ("boolean" === typeof options.enable) {
        this._isEnabled = options.enable;
    }

    var onValue = function(measurement) {

        var value = 0;

        if ("undefined" === measurement) {
            return;
        }

        // Temperature in degree Celsius expected
        switch (measurement.unitId) {

            // Kelvin
            case 0:
                value = vscp.measurement.convertKelvinToCelsius(measurement.value);
                break;

                // Celsius
            case 1:
                value = measurement.value;
                break;

                // Fahrenheit
            case 2:
                value = vscp.measurement.convertFahrenheitToCelsius(measurement.value);
                break;

                // Should never happen
            default:
                break;
        }

        value = vscp.measurement.toFixed(value, 1);

        this._temperature = value;
        this.draw();

    }.bind(this);

    // Create a VSCP measurement event decoder
    this.decoder = new vscp.measurement.Decoder({
        client: this.client,
        onValue: onValue,
        filter: {
            vscpClass: this.vscpClass,
            vscpType: this.vscpType,
            sensorIndex: this.sensorIndex
        }
    });

    /* Create
     * - one layer with the thermometer
     * - one layer with the disabled sign
     */
    $(this.canvasName)
        .drawImage({
            name: this._idThermometer,
            source: this.imageUrl,
            layer: true,
            x: this.x,
            y: this.y,
            scale: this.scale,
            visible: true
        })
        .addLayer({
            type: 'function',
            name: this._idDisabled,
            fn: (function() {

                var imageWidth = $(this.canvasName).getLayer(this._idThermometer).width * this.scale;
                var imageHeight = $(this.canvasName).getLayer(this._idThermometer).height * this.scale;

                $(this.canvasName)
                    .drawLine({
                        strokeStyle: '#f00',
                        strokeWidth: 2,
                        x1: (this.x - (imageWidth / 2)),
                        y1: (this.y - (imageHeight / 2)),
                        x2: (this.x + (imageWidth / 2)),
                        y2: (this.y + (imageHeight / 2))
                    })
                    .drawLine({
                        strokeStyle: '#f00',
                        strokeWidth: 2,
                        x1: (this.x - (imageWidth / 2)),
                        y1: (this.y + (imageHeight / 2)),
                        x2: (this.x + (imageWidth / 2)),
                        y2: (this.y - (imageHeight / 2))
                    });
            }).bind(this),
            visible: true
        })
        .addLayer({
            type: 'function',
            name: this._idData,
            fn: (function() {

                var imageWidth = $(this.canvasName).getLayer(this._idThermometer).width * this.scale;
                var imageHeight = $(this.canvasName).getLayer(this._idThermometer).height * this.scale;
                var maxDeltaT = this._data.maxT - this._data.minT;
                var realX = this._data.x * this.scale;
                var realY = this._data.y * this.scale;
                var realHeight = this._data.height * this.scale;
                var realWidth = this._data.width * this.scale;
                var realYOffset = this._data.yOffset * this.scale;
                var temperature = this._temperature;

                if (this._data.maxT < temperature) {
                    temperature = this._data.maxT;
                } else if (this._data.minT > this._temperature) {
                    temperature = this._data.minT;
                }

                var t = (temperature - this._data.minT) * realHeight / maxDeltaT;

                $(this.canvasName)
                    .drawRect({
                        fillStyle: this._data.color,
                        x: (this.x - (imageWidth / 2)) + realX,
                        y: (this.y - (imageHeight / 2)) + realY,
                        width: realWidth,
                        height: -realYOffset - t,
                        fromCenter: false
                    });
            }).bind(this),
            visible: true
        });

    this.draw();
};

/**
 * Draw the thermometer depended on its current state.
 */
vscp.widget.Thermometer.prototype.draw = function() {

    if (false === this._isEnabled) {
        $(this.canvasName).getLayer(this._idThermometer).visible = true;
        $(this.canvasName).getLayer(this._idData).visible = false;
        $(this.canvasName).getLayer(this._idDisabled).visible = true;
    } else {
        $(this.canvasName).getLayer(this._idThermometer).visible = true;
        $(this.canvasName).getLayer(this._idData).visible = true;
        $(this.canvasName).getLayer(this._idDisabled).visible = false;
    }

    $(this.canvasName).drawLayers();
};

/**
 * Enable or disable the thermometer.
 *
 * @param {boolean} value - Enable (true) or disable (false) it
 */
vscp.widget.Thermometer.prototype.setEnabled = function(value) {

    if ("boolean" !== typeof value) {
        return;
    }

    this._isEnabled = value;
    this.draw();
};