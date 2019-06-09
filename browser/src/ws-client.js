
window.WsClient = function() {
    var ws=null;
    var connected = false;
    var hearTimer = null;
    this.connectWsServer = function() {
        ws = new WebSocket('ws://127.0.0.1:8887/ball');
        connected = false;
        function hear() {
            ws.send(JSON.stringify({action: 'auth', type: 'monitor'}));
            ws.send(JSON.stringify({action: 'hear', time: new Date().getTime()}));
        }
    
        ws.onopen = function(){
            console.log('ws连接成功');
            ws.send(JSON.stringify({action: 'auth', type: 'monitor'}));
            connected = true;
            hearTimer = setInterval(hear, 15000);
        }

        ws.onclose = function(){
            connected = false;
            clearInterval(hearTimer);
            alert('ws断开连接');
        }
    }

    this.sendWsData = function(data) {
        /*
        var send_data = {
            action: 'update',
            team: '123',
            node: 2,
            home_name: '123',
            away_name: '',
            home_score: 20.5,
            away_score: -20.5,
        }
        */
        ws.send(JSON.stringify(data));
    }
    return this;
}
