<img src="https://vscp.org/images/logo.png" width="100">

This modules supplies VSCP tcp/ip remote functionality that make it possible to connect to a remote VSCP server (vscpd) or a tcp/ip based VSCP device.


## Install

    npm install node-vscp-tcp --save

Remove --save if you don't want to save dependencies to package.json

## Usage

Include the module with

```javascript
const vscp_tcp_client = require('node-vscp-tcp');
...
```

You can use the functionality of this module both with callbacks and promises.

Easiest is to use async calls like this

```javascript
const testAsync = async () => {

  let vscp_tcp_client = new vscp_tcp_Client();

  // Connect to VSCP server/device
  const value1 = await vscp_tcp_client.connect(
    {
      host: "localhost",
      port: 9598,
      timeout: 10000
    });

  // Send no operation command (does nothing)
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });

  // Send no operation command (does nothing)
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });

  // Send no operation command (does nothing)
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });

  // Log on to server (step 1 user name)
  // The response object is returned and logged
  const userResponse = await vscp_tcp_client.sendCommand(
    {
      command: "user",
      argument: "admin"
    });
  console.log(userResponse);

  // Log on to server (step 2 password)
  await vscp_tcp_client.sendCommand(
    {
      command: "pass",
      argument: "secret"
    });

  // Get interfaces available on remote VSCP server
  const iff = await vscp_tcp_client.getInterfaces();
  console.log(iff);

  // Send no operation command (does nothing)
  await vscp_tcp_client.sendCommand(
    {
      command: "noop"
    });

  // Get VSCP remote server version
  const ver = await vscp_tcp_client.getRemoteVersion();
  console.log(ver);

  // Get number of VSCP events waiting to be fetched
  const cnt = await vscp_tcp_client.getPendingEventCount();
  console.log(cnt);
  console.log(vscp.version.major);
  console.log(vscp.varTypes);
  console.log(vscp.varTypeNames[1]);
  console.log(vscp);

  // Create a remote variable named 'testvar'. Type=string
  const varCreate = await vscp_tcp_client.writeVar({
    name: "testvar",
    value: 'This is a test åäöÅÄÖ',
    note: 'This is a super variable åäöÅÄÖ'
  });
  console.log(varCreate);

  // List all stock variables
  const varList = await vscp_tcp_client.listVar({
    onSuccess: success,
    regex: 'vscp'
  });
  console.log(varList);

  // Read remote variable 'testvar' info
  const varRead = await vscp_tcp_client.readVar({
    name: 'testvar'
  });
  console.log(varRead);

  // Read remote variable 'testvar' value
  const varReadValue = await vscp_tcp_client.readVarValue({
    name: 'testvar'
  });
  console.log(varReadValue);

  // Write a new value to remote variable 'testvar'
  const varWriteValue = await vscp_tcp_client.writeVarValue({
    name: 'testvar',
    value: 'Det här är det nya värdet'
  });
  console.log(varWriteValue);

  // Read value of remote variable testvar
  const varReadValue2 = await vscp_tcp_client.readVarValue({
    name: 'testvar'
  });
  console.log(varReadValue2);

  // Read note for remote variable 'testvar'
  const varReadNote = await vscp_tcp_client.readVarNote({
    onSuccess: success,
    name: 'testvar'
  });
  console.log(varReadNote);

  // Disconnect from remote VSCP server/device
  await vscp_tcp_client.disconnect();
}

testAsync().catch(err => {
  console.log("Catching error");
  console.log(err);
})
```

Several of the commands above is sent using **sendcommand**. This command allows for sending any command and argument and the response will be a response object with information about the outcome of the command. For example  the user command reponse is

```javascript
{ command: 'USER',
  argument: 'admin',
  response: [ '+OK - User name accepted, password please' ],
  result: 'success' }
```

The content is pretty obvious.

* **command** - The issued command.
* **argument** - Command argument.
* **result** - 'success' if a positive reply was detected.
* **response** - This is an array with the response from the server. Each item is string and the last entry is always '+OK......" in some form.

The obvious way to get events is to poll fo them. You can do that wit the following code

```javascript

```

But better is to have a second connection to the remote server/device and use the **startRcvLoop** (rcvloop) command as we do here. Now there is no need to poll for events

```javascript
const testRcvLoop = async () => {

  let vscp_tcp_client = new vscp_tcp_Client();

  // Add a lister function for events from remote server
  vscp_tcp_client.addEventListener((e) => {
    console.log("Event received");
  });

  // Connect to VSCP server/device
  const value1 = await vscp_tcp_client.connect(
    {
      host: "localhost",
      port: 9598,
      timeout: 10000,
      onSuccess: null
    });

  // Login with username
  const ttt = await vscp_tcp_client.user(
    {
      username: "admin"
    });

  // ...and password
  await vscp_tcp_client.password(
    {
      password: "secret"
    });

  // Start the receive loop
  await vscp_tcp_client.startRcvLoop();
}

testRcvLoop().catch(err => {
  console.log("Catching error");
  console.log(err);
})
```

It is always ok to have more then one connection open to a VSCP daemon. This is not always true for a low end tcp/ip device. Some may just allow for one client connection. You can use the **wcyd** command to check if a node accept more than one connection.

Another thing to remember if you have more than one connection to a remote server/device is that if you just open up a second connection you will receive the events you send on the other connection.You can prevent this by setting the receiving channels channel id to the same value as the sending channels id. User **getChannelID** to get the channel oid and set it with **setChannelID**

All commands allow you to specify an **onsuccess** and an **onerror** callback. This may be they way yo prefers to work instead of using promises.

Here are a sample without async/await

```javascript
function testPromise() {

  var start = new Date().getTime();
  let vscp_tcp_client = new vscp_tcp_Client();

  vscp_tcp_client.connect(
    {
      host: "127.0.0.1",
      port: 9598,
      timeout: 10000,
      onSuccess: null
    })
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "noop"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "noop"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "noop"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "user",
        argument: "admin"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "pass",
        argument: "secret"
      }))
    .then((obj) => vscp_tcp_client.sendCommand(
      {
        command: "interface",
        argument: "list",
        onSuccess: aaaa
      }))
    .then(obj => {
      console.log('Last command');
      console.log(obj);
      vscp_tcp_client.disconnect();
    })
    .then(obj => {
      var end = new Date().getTime();
      var time = end - start;
      console.log('Execution time: ' + time)
    })
    .catch(err => console.log("Catch Error " + err.message));
  ;
}

testPromise();
```


---

This package is part of the [VSCP(Very Simple Control Protocol)](https://www.vscp.org) IoT framework.
