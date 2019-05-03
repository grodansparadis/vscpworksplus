// VSCP measurement javascript library
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

/*jshint bitwise: false */

/** VSCP response timeout in ms
 * @type {number}
 * @const
 */
module.exports.timeout = 5000;


/** VSCP units
 * @type {string[]}
 */
module.exports.constants.units = [

    // Generic
    [],
    // Count
    [],
    // Length/Distance
    ["Meter"],
    // Mass
    ["Kilogram"],
    // Time
    ["Millisecond", "Seconds"],
    // Electrical Current
    ["Ampere"],
    // Temperature
    ["Kelvin", "Celsius", "Fahrenheit"],
    // Amount of substance
    ["Mole"],
    // Luminous Intensity (Intensity of light)
    ["Candela"],
    // Frequency
    ["Hertz"],
    // Radioactivity and other random events
    ["Becquerel"],
    // Force
    ["Newton"],
    // Pressure
    ["Pascal", "Bar", "Psi"],
    // Energy
    ["Joule"],
    // Power
    ["Watt"],
    // Electrical Charge
    ["Coulomb"],
    // Electrical Potential (Voltage)
    ["Volt"],
    // Electrical Capacitance
    ["Farad"],
    // Electrical Resistance
    ["Ohm"],
    // Electrical Conductance
    ["Siemens"],
    // Magnetic Field Strength
    ["Ampere meters"],
    // Magnetic Flux
    ["Weber"],
    // Magnetic Flux Density
    ["Tesla"],
    // Inductance
    ["Henry"],
    // Luminous Flux
    ["Lumen"],
    // Illuminance
    ["Lux"],
    // Radiation dose
    ["Gray", "Sievert"],
    // Catalytic activity
    ["Katal"],
    // Volume
    ["Cubic meter", "Liter"],
    // Sound intensity
    ["Bel", "Neper", "dB"],
    // Angle
    ["Rad", "Degree", "Arcminute", "Arcseconds"],
    // Position
    ["Longitude", "Latitude"],
    // Speed
    ["Meters per second"],
    // Acceleration
    ["Meters per second/second"],
    // Tension
    ["N/m"],
    // Damp/moist (Hygrometer reading)
    ["%"],
    // Flow
    ["Cubic meters/second", "Liter/Second"],
    // Thermal resistance
    ["K/W"],
    //  Refractive power
    ["Dioptre"],
    // Dynamic viscosity
    ["Poiseuille"],
    // Sound impedance
    ["Rayal"],
    // Sound resistance
    ["Acoustic ohm"],
    // Electric elastance
    ["Darag"],
    // Luminous energy
    ["Talbot"],
    // Luminance
    ["Nit"],
    // Chemical concentration
    ["Molal"],
    // Reserved
    ["Reserved"],
    // Dose equivalent
    ["Sievert"],
    // Reserved
    ["Reserved"],
    // Dew Point
    ["Levin", "Celsius", "Fahrenheit"],
    // Relative Level
    ["Relative"],
    // Altitude
    ["Meter", "Feet", "Inches"],
    // Area
    ["Square meter"],
    // Radiant intensity
    ["Watt per steradian"],
    // Radiance
    ["Att per steradian per square metre"],
    // Irradiance, Exitance, Radiosity
    ["Watt per square metre"],
    // Spectral radiance
    ["Watt per steradian per square metre per nm"],
    // Spectral irradiance
    ["Watt per square metre per nm"]
];

/* ---------------------------------------------------------------------- */

/**
 * Round value to a fixed precision.
 *
 * @param {number} value        - Value
 * @param {number} precision    - Precision
 *
 * @return {number} Rounded value
 */
module.exports.toFixed = function(value, precision) {
    var power = Math.pow(10, precision || 0);
    return String((Math.round(value * power) / power).toFixed(precision));
};

/**
 * Convert a integer value to float
 *
 * @param {number[]} data - Byte array
 * @return {number} Float value
 */
module.exports.varInteger2Float = function(data) {
    var rval = 0.0;
    var bNegative = false;
    var i = 0;

    if (0 !== (data[0] & 0x80)) {
        bNegative = true;

        for (i = 0; i < data.length; i++) {
            data[i] = ~data[i] & 0xff;
        }
    }

    for (i = 0; i < data.length; i++) {
        rval = rval << 8;
        rval += data[i];
    }

    if (true === bNegative) {
        rval = -1.0 * (rval + 1);
    }

    return rval;
};

/**
 * Get data coding.
 *
 * @param {number} data - Data
 * @return {number} Coding
 */
module.exports.getDataCoding = function(data) {
    return (data >> 5) & 7;
};

/**
 * Get unit from data coding.
 *
 * @param {number} data - Data coding
 * @return {number} Unit
 */
module.exports.getUnitFromDataCoding = function(data) {
    return (data >> 3) & 3;
};

/**
 * Get sensor index from data coding.
 *
 * @param {number} data - Data coding
 * @return {number} Sensor index
 */
module.exports.getSensorIndexFromDataCoding = function(data) {
    return data & 7;
};

/**
 * Decode a class 10 measurement.
 *
 * @param {number[]} data - Data (event data array where first data byte is the data coding)
 * @return {number} Value as float
 */
module.exports.decodeClass10 = function(data) {
    var rval = 0.0;
    var newData = [];
    var sign = 0;
    var exp = 0;
    var mantissa = 0;
    var str = "";
    var i = 0;

    switch (module.exports.getDataCoding(data[0])) {
        case 0: // Bits
        case 1: // Bytes
        case 3: // Integer
            for (i = 1; i < data.length; i++) {
                newData[i - 1] = data[i];
            }
            rval = module.exports.varInteger2Float(newData);
            break;

        case 2: // String
            for (i = 1; i < data.length; i++) {
                str += String.fromCharCode(data[i]);
            }
            rval = parseFloat(str);
            break;

        case 4: // Normalized integer
            exp = data[1];

            for (i = 2; i < data.length; i++) {
                newData[i - 2] = data[i];
            }

            rval = module.exports.varInteger2Float(newData);

            // Handle mantissa
            if (0 !== (exp & 0x80)) {
                exp &= 0x7f;
                rval = rval / Math.pow(10, exp);
            } else {
                exp &= 0x7f;
                rval = rval * Math.pow(10, exp);
            }
            break;

        case 5: // Floating point
            if (5 === data.length) {
                sign = data[1] & 0x80; // Negative if != 0
                exp = (data[1] & 0x7f) << 1 + (data[2] & 0x80) ? 1 : 0;
                mantissa = (data[2] & 0x7f) << 16 + data[3] << 8 + data[4];
                // sign * 2^exponent * mantissa
                rval = Math.pow(2, exp) * mantissa;
                if (sign) {
                    rval = -1 * rval;
                }
            }
            break;

        case 6: // Reserved
            break;

        case 7: // Reserved
            break;

        default:
            break;
    }

    return rval;
};

/**
 * Decode a class 60 measurement.
 *
 * @param {number}  data - Data
 * @return {number} Value as float
 */
module.exports.decodeClass60Number = function(data) {
    var rval = 0;
    var sign = 0;
    var exp = 0;
    var mantissa = 0;

    if (8 === data.length) {

        sign = data[0] & 0x80; // Negative if != 0
        exp = (data[0] & 0x7f) << 4 + (data[1] & 0xf0) >> 4;
        mantissa = (data[1] & 0x0f) << 48 +
            data[2] << 40 +
            data[3] << 32 +
            data[4] << 24 +
            data[5] << 16 +
            data[6] << 8 +
            data[7];

        // sign * 2^exponent * mantissa
        rval = Math.pow(2, exp) * mantissa;

        if (0 !== sign) {
            rval = -1 * rval;
        }
    }

    return rval;
};

/**
 * Decode a class 65 measurement.
 *
 * @param {number} data - Data
 * @return {number} Value as float
 */
module.exports.decodeClass65Number = function(data) {
    var rval = 0;
    var exp = data[3];
    var i = 0;

    for (i = 4; i < data.length; i++) {
        rval = rval << 8;
        rval += data[i];
    }

    // Handle exponent
    if (0 !== (exp & 128)) {
        exp &= 0x7f;
        rval = rval * Math.pow(10, (-1 * exp));
    } else {
        rval = rval * Math.pow(10, exp);
    }

    return rval;
};

/**
 * Convert from unit fahrenheit to unit kelvin.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertFahrenheitToKelvin = function(value) {
    var fTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    var cTempVal = ((fTempVal - 32) * (5 / 9)) + 273.15;
    return cTempVal;
};

/**
 * Convert from unit fahrenheit to unit celsius.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertFahrenheitToCelsius = function(value) {
    var fTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    var cTempVal = (fTempVal - 32) * (5 / 9);
    return cTempVal;
};

/**
 * Convert from unit celsius to unit fahrenheit.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertCelsiusToFahrenheit = function(value) {
    var cTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    var fTempVal = (cTempVal * (9 / 5)) + 32;
    return fTempVal;
};

/**
 * Convert from unit kelvin to unit celsius.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertKelvinToCelsius = function(value) {
    var kTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    var cTempVal = kTempVal - 273.15;
    return cTempVal;
};

/**
 * Convert from unit celsius to unit kelvin.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertCelsiusToKelvin = function(value) {
    var kTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    var cTempVal = kTempVal + 273.15;
    return cTempVal;
};

/**
 * Convert from unit kelvin to unit fahrenheit.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertKelvinToFahrenheit = function(value) {
    var kTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    var cTempVal = kTempVal + 273.15;
    return module.exports.convertCelsiusToFahrenheit(cTempVal);
};

/**
 * Convert from unit meter to unit feet.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertMeterToFeet = function(value) {
    var fTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    return fTempVal * 3.2808399;
};

/**
 * Convert from unit feet to unit meter.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertFeetToMeter = function(value) {
    var fTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    return fTempVal * 0.3048;
};

/**
 * Convert from unit meter to unit inch.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertMeterToInch = function(value) {
    var fTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    return fTempVal * 3.2808399 * 12;
};

/**
 * Convert from unit inch to unit meter.
 *
 * @param {string|number} value - Value
 * @return {number} Converted value
 */
module.exports.convertInchToMeter = function(value) {
    var fTempVal = ("string" === typeof value) ? parseFloat(value) : value;
    return fTempVal * 0.3048 / 12;
};

/**
 * Measurement decoder
 * @class
 *
 * @param {object} options                      - Options
 * @param {vscp.ws.Client} options.client       - VSCP websocket client
 * @param {function} options.onValue            - Function which will be called for every received measurement value.
 * @param {object} options.filter               - Filter
 * @param {string} options.filter.vscpGuid      - Node GUID string
 * @param {number} options.filter.vscpClass     - VSCP class
 * @param {number} options.filter.vscpType      - VSCP type
 * @param {number} options.filter.sensorIndex   - Sensor index
 * @param {number} options.filter.zone          - Zone
 * @param {number} options.filter.subZone       - Sub-zone
 */
module.exports.Decoder = function(options) {

    /** VSCP websocket client
     * @member {vscp.ws.Client}
     */
    this.client = null;
    /** Callback which will be called for every received value.
     * @member {function}
     */
    this.onValue = null;
    /** Filter
     * @member {object}
     * @property {string} vscpGuid      - Node GUID string
     * @property {number} vscpClass     - VSCP class
     * @property {number} vscpType      - VSCP type
     * @property {date}   datetime      - datetime
     * @property {number} sensorIndex   - Sensor index
     * @property {number} zone          - Zone
     * @property {number} subZone       - Sub-zone
     */
    this.filter = null;

    if ("undefined" !== typeof options) {

        if (true === (options.client instanceof vscp.ws.Client)) {
            this.client = options.client;
        }

        if ("function" === typeof options.onValue) {
            this.onValue = options.onValue;
        }

        if ("object" === typeof options.filter) {
            this.filter = options.filter;
        }
    }

    if (null !== this.client) {
        this.client.addEventListener(this.eventListener.bind(this));
    }
};

/**
 * VSCP event listener, which receives, filters and converts every received measurement event.
 * @private
 *
 * @param {vscp.ws.Client} client   - VSCP connection
 * @param {vscp.Event} evt          - VSCP event
 */
module.exports.Decoder.prototype.eventListener = function(client, evt) {

    var sensorIndex = -1;
    var value = 0;
    var unitId = -1;
    var unit = "";
    var zone = 255;
    var subZone = 255;
    var mimicData = [];
    var index = 0;

    if ("undefined" === typeof evt) {
        return;
    }

    if (false === (evt instanceof vscp.Event)) {
        return;
    }

    // Apply pre filter
    if (null !== this.filter) {

        if (("undefined" !== typeof this.filter.vscpGuid) &&
            (evt.vscpGuid.toLowerCase() !== this.filter.vscpGuid.toLowerCase())) {
            return;
        }

        if (("undefined" !== typeof this.filter.vscpClass) &&
            (evt.vscpClass !== this.filter.vscpClass)) {
            return;
        }

        if (("undefined" !== typeof this.filter.vscpType) &&
            (evt.vscpType !== this.filter.vscpType)) {
            return;
        }
    }

    // Classes with data coding byte
    if ((vscp.constants.classes.VSCP_CLASS1_MEASUREMENT === evt.vscpClass) ||
        (vscp.constants.classes.VSCP_CLASS1_DATA === evt.vscpClass)) {

        sensorIndex = module.exports.getSensorIndexFromDataCoding(evt.vscpData[0]);
        value = module.exports.decodeClass10(evt.vscpData);
        unitId = module.exports.getUnitFromDataCoding(evt.vscpData[0]);
        unit = module.exports.constants.units[evt.vscpType][unitId];
    }
    // Floating point
    else if (vscp.constants.classes.VSCP_CLASS1_MEASUREMENT64 === evt.vscpClass) {
        value = module.exports.decodeClass60Number(evt.vscpData);
        unitId = module.exports.getUnitFromDataCoding(evt.vscpData[0]);
        unit = module.exports.constants.units[evt.vscpType][unitId];
    }
    // Measurement with zone information
    else if ((vscp.constants.classes.VSCP_CLASS1_MEASUREZONE === evt.vscpClass) ||
        (vscp.constants.classes.VSCP_CLASS1_SETVALUEZONE === evt.vscpClass)) {

        mimicData.push(evt.vscpData[0]);
        for (index = 3; index < evt.vscpData.length; ++index) {
            mimicData.push(evt.vscpData[index]);
        }

        sensorIndex = module.exports.getSensorIndexFromDataCoding(evt.vscpData[0]);
        value = module.exports.decodeClass10(mimicData);
        unitId = module.exports.getUnitFromDataCoding(evt.vscpData[0]);
        unit = module.exports.constants.units[evt.vscpType][unitId];
        zone = evt.vscpData[1];
        subZone = evt.vscpData[2];
    } else {
        return;
    }

    // Apply post filter
    if (null !== this.filter) {

        if (("undefined" !== typeof this.filter.sensorIndex) &&
            (sensorIndex !== this.filter.sensorIndex)) {
            return;
        }

        if (("undefined" !== typeof this.filter.zone) &&
            (zone !== this.filter.zone)) {
            return;
        }

        if (("undefined" !== typeof this.filter.subZone) &&
            (subZone !== this.filter.subZone)) {
            return;
        }
    }

    // Signal application
    if (null !== this.onValue) {
        this.onValue({
            sensorIndex: sensorIndex,
            value: value,
            unitId: unitId,
            unit: unit,
            zone: zone,
            subZone: subZone,
            event: evt
        });
    }
};