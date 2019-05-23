// classdef.js
//
// Copyright (C) 2012-2019 Ake Hedman, Grodans Paradis AB
// <akhe@grodansparadis.com>
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

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dates = require('./dates.js');

///////////////////////////////////////////////////////////////////////////////
// checkForNewClassDefs
//
// Check if there are newer VSCP class/type definitions available and if
// so download. Directory used for the checks is '~/.vscpworks/events'
//

loadClassDefs = function (pathEvents) {

  let clssdefs = {};

  // Read in class/type definitions if they are there
  try {
    if (fs.existsSync(path.join(pathEvents, 'vscp_events.json'))) {
      let rawdata = fs.readFileSync(path.join(pathEvents, 'vscp_events.json'));
      classdefs =  JSON.parse(rawdata);
    }
  }
  catch (err) {
    console.error("Failed to fetch predefined connections from " + pathConnectConfig);
    console.error(err);
  }
  
  return classdefs.events;

}

checkForNewClassDefs = function (pathEvents, onLoad ) {

  let rawdata = '';
  let data = '';
  let dateLocal = new Date('1923-03-11T13:45:10');
  let dateServer = new Date('2021-11-02T13:45:10');

  // Fetch version always if one or both files are missing
  if (fs.existsSync(path.join(pathEvents, 'version.json')) &&
    fs.existsSync(path.join(pathEvents, 'vscp_events.json'))) {
    rawdata = fs.readFileSync(path.join(pathEvents, 'version.json'));
    let data = JSON.parse(rawdata);
    dateLocal = new Date(data.generated);
  }

  axios.get('http://vscp.org/events/version.json')
    .then((response) => {
      dateServer = new Date(response.data.generated);
      if (-1 !== dates.compare(dateLocal, dateServer)) {
        console.log('VSCP class/type definition file are up to date.');
        if ( ('undefined' !== typeof onLoad) ) {
          console.log('Loading');
          onLoad(loadClassDefs(pathEvents));
        }
      }
      else {

        console.log('There is a new version of the VSCP class/type definition file - downloading.');

        fs.writeFile(path.join(pathEvents, 'version.json'),
          JSON.stringify(response.data), 'utf-8', (err) => {

            if (err) throw err;

            console.log('File: version.json downloaded.');

            axios.get('http://vscp.org/events/vscp_events.json')
              .then((response) => {
                fs.writeFile(path.join(pathEvents, 'vscp_events.json'),
                  JSON.stringify(response.data), 'utf-8', (err) => {
                    if (err) throw err;
                    console.log('File: vscp_events.json downloaded.');
                    if ( ('undefined' !== typeof onLoad)) {
                      onLoad(loadClassDefs(pathEvents));
                    }
                  })

              });

          });
      }
    })
    .catch((error) => {
      console.log('Failed to fetch class/type definition files');
      console.log(error);
    });

}

module.exports.checkForNewClassDefs = checkForNewClassDefs