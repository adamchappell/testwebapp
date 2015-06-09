#!  /usr/local/bin/node

// Global
var FILES = {};     // pre-loaded content
var CLIENTS = {};   // connected clients

// Test memory structure
var COUNT = 1;
var MAX = 20;

// Import modules
var fs = require('fs');
var path = require('path');
var os = require('os');
var http = require('http');
var io = require('socket.io');

// Event handlers here
//
// Handle an HTTP request
var handleHttpRequest = function (req, res) {
    // Gather important data
	var hostname = os.hostname();
    var remoteAddress = req.connection.remoteAddress;
    var localAddress = req.connection.address()['address'];
    var method = req.method;
    var host = req.headers['host'];
    var url = req.url;
    
    console.log("Client " + localAddress + " -> " + host + " " + method + " " + url);
    
    // Redirect the root URL to index.html
    if (url==="/") { url = "/index.html"; }
    
    // Serve a file if appropriate
    if (FILES[url]!=undefined && method==="GET") {
        if (url.match(".js$")) { res.writeHead(200, {'Content-Type': 'text/javascript'}) }
        else if (url.match(".html")) { res.writeHead(200, {'Content-Type': 'text/html'}) }
        else { res.writeHead(200, {'Content-Type': 'text/plain'}); }
        res.end(FILES[url].replace("$HOST", hostname)); // mini-PHP :)
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write("The request could not be satisfed: " + method + " " + host + url + " (" + hostname + ")\n");
        res.end();
    }
};

// Handle a websocket. Store the identifer in the global list
var handleSocketConnect = function (socket) {
    var id = socket.id;
    console.log("client " + id + " connected");
    CLIENTS[id] = socket;
    socket.on('disconnect', function() { handleSocketDisconnect(id); });
    socket.on('malloc', function() { handleLeak(); });
};

// Handle a socket disconnect. Remove the client id from the connected list
var handleSocketDisconnect = function (id) {
    delete CLIENTS[id];
    console.log("client " + id + " disconnected");
};

// Heartbeat timer handler. Report server stats to connected clients
var handleTimer = function() {
    var stats = {
        hostname: os.hostname(),
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
//        totalmem: os.totalmem(),
//        freemem: os.freemem(),
        totalmem: MAX,
        freemem: COUNT
    };
    
    var count = 0;
    for (var client in CLIENTS) {
        var socket = CLIENTS[client];
        count++;
        socket.emit('stats', stats);
    }
    console.log("Wrote stats to " + count + " connected clients");
    console.log(stats);
}

var handleLeak = function() {
    COUNT++;
    if (COUNT>MAX) process.exit(0);
}

// MAIN
//
// Process command line to get preload contents
process.argv.forEach(function(val, index, array) {
    if (index>=2) {
        var name = "/" + path.basename(val);
        console.log("Preloading file " + val + " as " + name);
        FILES[name] = fs.readFileSync(val).toString();
    }
});

// Create the HTTP server and the connection handler
var httpServer = http.createServer(handleHttpRequest);

// Create the socket.io server, which will hook the
// HTTP request handler (to deal with /socket.io prefixes).
var webSocketServer = io.listen(httpServer, { log: false });

// Set the Web Socket server connection handler
webSocketServer.sockets.on('connection', handleSocketConnect);

// Start the server listening for connections
httpServer.listen(8080);

// Set an interval timer to output server stats
// to all connected clients
setInterval(handleTimer, 1000);

// Set an interval timer to leak some memory
setInterval(handleLeak, 10000);
