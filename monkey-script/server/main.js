const http = require('http');
const WebSocket = require('ws');
const url = require('url');


const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

var monitor_ws = null;
var down_bet_ws = null;


wss.on('connection', function connection(ws, req) {
  var user_id =  req.connection.remoteAddress;

  ws.on('message', function(message) {
    try {
      var data = JSON.parse(message);
      switch(data.action) {
        case 'auth': {
          if(data.type == 'monitor') {
            monitor_ws = this;
          } else if(data.type == 'bet') {
            down_bet_ws = this;
          }
          break;
        }
        case 'update': {
          try {
            down_bet_ws.send(JSON.stringify(data));
          } catch(e) {

          }
          break;
        }
        case 'hear': {
          try {
            ws.send(JSON.stringify({action:'hear'}));
          }catch(e) {
            
          }
        }
        default:
          break;
      }
    } catch(e) {
      console.log(e)
    }
   

  });
  ws.on('close', function() {
    if(monitor_ws == this){
      monitor_ws = null;
    }
    if(down_bet_ws == this){
      down_bet_ws = null;
    }
  });
});


server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;
 
  if (pathname === '/ball') {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
  }
  else {
    socket.destroy();
  }
});

server.listen(8887);
console.log('启动: http://127.0.0.1:8887/ball');
