/** VSCP tcp/ip command responses and unsolicited messages
     *
     * @private
     * @member {object}
     */
    this._tcpipMessages = [
        {

            event: "AUTH0",
            onSuccess: function (client, parameter) {
                var cmd = client._getPendingCommand("CHALLENGE");

                if (null !== cmd) {

                    console.info(vscp.utility.getTime() + " Security challenge received.");

                    client._sendCommand({
                        command: "AUTH",
                        data: client.getAuthHash(client.userName,
                            client.password,
                            client.vscpkey,
                            parameter[2] // iv
                        ),
                        onSuccess: null,
                        onError: null,
                        resolve: null,
                        reject: null
                    });
                }

                return;
            },
            /* eslint-disable no-unused-vars */
            onError: function (client, parameter) {
                /* eslint-enable no-unused-vars */
                var cmd = client._getPendingCommand("_CONNECT_");

                console.error(vscp.utility.getTime() + " Authentication initiation aborted.");

                if (null !== cmd) {
                    client._signalConnError();
                    client.socket.close();
                } else {
                    console.error(vscp.utility.getTime() + " AUTH0 negative reply received, but no challenge is pending!?");
                }

                if (null !== cmd) {
                    if (null !== cmd.reject) {
                        cmd.reject(Error("Authentication failed."));
                    }
                }

                return;
            }
        },
        {
            event: "AUTH",
            onSuccess: function (client, parameter) {
                var cmd = client._getPendingCommand("CHALLENGE");

                if (null !== cmd) {

                    console.info(vscp.utility.getTime() + " Security challenge received.");

                    client._sendCommand({
                        command: "AUTH",
                        data: this.getAuthHash(client.userName,
                            client.password,
                            client.vscpkey,
                            parameter[2] // iv
                        ),
                        onSuccess: null,
                        onError: null,
                        resolve: null,
                        reject: null
                    });
                }

                return;
            },
            onError: null
        }, {
            event: "AUTH1",
            onSuccess: function (client, parameter) {
                var cmd = client._getPendingCommand("AUTH");

                if (null !== cmd) {
                    console.info(vscp.utility.getTime() + " Authentication successful.");

                    // Save authenticated user info
                    client.userId = parseInt(parameter[2]);
                    client.userFullname = parameter[3];
                    client.userRights = parameter[4].split("/");
                    client.userRemotes = parameter[5];
                    client.userEvents = parameter[6];
                    client.userNote = parameter[7];

                    if (client.states.CONNECTED === client.state) {
                        client._signalSuccess("_CONNECT_");
                    }
                }

                return;
            },
            /* eslint-disable no-unused-vars */
            onError: function (client, parameter) {
                /* eslint-enable no-unused-vars */
                var cmd = client._getPendingCommand("_CONNECT_");

                console.error(vscp.utility.getTime() + " Authentication failed.");

                if (null !== cmd) {
                    client._signalConnError();
                    client.socket.close();
                } else {
                    console.error(vscp.utility.getTime() + " AUTH1 negative reply received, but no challenge is pending!?");
                }

                if (null !== cmd) {
                    if (null !== cmd.reject) {
                        cmd.reject(Error("Authentication failed."));
                    }
                }

                return;
            }
        }, {
            event: "OPEN",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Receiving events started.");
                client.substate = client.substates.OPEN;
                client._signalSuccess(parameter[1]);

                return;
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Receiving events couldn't be started.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );

                return;
            }
        }, {
            event: "CLOSE",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Receiving events stopped.");
                client.substate = client.substates.CLOSE;
                client._signalSuccess(parameter[1]);
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Receiving events couldn't be stopped.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "CLRQ",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " VSCP event queue cleared.");
                client._signalSuccess(parameter[1]);
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " VSCP event queue couldn't be cleared.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "EVENT",
            onSuccess: function (client, parameter) {
                //console.info( vscp.utility.getTime() + " VSCP event successful sent." );
                client._signalSuccess(parameter[1]);
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Failed to send VSCP event.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "SF",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Filter successfully set.");
                client._signalSuccess(parameter[1]);
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Filter couldn't bet set.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "RVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable " + parameter[2] + " (" + parameter[4] + ") successful read.");
                client._signalSuccess(
                    parameter[1], {
                        // name;type;userid;accessright,bPersistent;userid;rights;lastchanged;value;note
                        name: parameter[2], // Variable name
                        type: parseInt(parameter[3]), // Variable type
                        userid: parseInt(parameter[4]), // Variable user
                        accessright: parseInt(parameter[5]), // Variable access
                        persistency: ("false" === parameter[6]) ? false : true, // Variable persistency
                        lastchange: parameter[7], // Variable lastchange
                        value: vscp.decodeValueIfBase64(parseInt(parameter[3]), parameter[8]), // Variable value
                        note: vscp.b64DecodeUnicode(parameter[9]) // Variable note
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable couldn't be read.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "WVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable successfully written.");
                client._signalSuccess(
                    parameter[1], {
                        name: parameter[2], // Variable name
                        type: parseInt(parameter[3]), // Variable type
                        value: parameter[4] // Variable value
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable couldn't be written.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "CVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable successfully created.");
                client._signalSuccess(parameter[1]);
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable couldn't be created.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "RSTVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable successfully reset.");
                client._signalSuccess(
                    parameter[1], {
                        name: parameter[2], // Variable name
                        type: parameter[3], // Variable type
                        value: parameter[4] // Variable value
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable couldn't be reset.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "DELVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable successfully removed.");
                client._signalSuccess(
                    parameter[1], {
                        name: parameter[2] // Variable name
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable couldn't be removed.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "LENVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable length successfully read.");
                client._signalSuccess(
                    parameter[1], {
                        name: parameter[2], // Variable name
                        length: parseInt(parameter[3]) // Variable length
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable length couldn't be read.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "LCVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable last change successfully read.");
                client._signalSuccess(
                    parameter[1], {
                        name: parameter[2], // Variable name
                        lastChange: parameter[3] // Variable last changed
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variable last change couldn't be read.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "LSTVAR",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Variable successfully listed.");
                client._signalSuccess(parameter[1]);
                client._signalVariable({
                    // +;LSTVAR;ordinal;count;name;type;userid;accessrights;persistance;last_change
                    idx: parseInt(parameter[2]), // Ordinal
                    count: parseInt(parameter[3]), // Total # variables
                    name: parameter[4], // Variable name
                    type: parameter[5], // Variable type
                    userid: parseInt(parameter[6]), // Variable user
                    accessright: parseInt(parameter[7]), // Variable access rights
                    persistency: ("false" === parameter[8]) ? false : true, // Variable persistency
                    lastchange: parameter[9], // Variable date
                });
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Variables couldn't be listed.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "TBL_GET",
            onSuccess: function (client, parameter) {
                console.info(vscp.utility.getTime() + " Table successfully read.");
                client._signalSuccess(
                    parameter[1], {
                        count: parseInt(parameter[2]) // Number of rows that will follow via TR
                    }
                );
            },
            onError: function (client, parameter) {
                console.error(vscp.utility.getTime() + " Table couldn't be read.");
                client._signalError(
                    parameter[1], {
                        id: parseInt(parameter[2]), // Error code
                        str: parameter[3] // Error string
                    }
                );
            }
        }, {
            event: "TR",
            onSuccess: function (client, parameter) {
                client._signalTableRow({
                    date: parameter[2], // Date and time
                    value: parameter[3] // Value
                });
            },
            onError: null
        }];

    return this;
};



