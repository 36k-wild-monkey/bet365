

const WebSocket = require('isomorphic-ws')
const axios = require('axios')

const HANDSHAKE_MESSAGE_DELIM = '\x03'
const HANDSHAKE_STATUS_CONNECTED = '100'
const HANDSHAKE_STATUS_REJECTED = "111"
const MESSAGE_DELIM = '\b'
const INITIAL_TOPIC_LOAD = 20
const RECORD_DELIM = '\x01'
const FIELD_DELIM = '\x02'
const DELTA = 21
const CLIENT_ABORT = 28
const CLIENT_CLOSE = 29


var isHandShake = false
var userConnectId = null
var connectStatus = false
var matchData = {}
var matchId = null// 篮球id = 18
var ws
var updateGameDataCallback = null
var updateGameEventInfoCallback = null

class Team {
    constructor() {

        this.league = null
        this.leagueId = null
        this.leagueIt = null
        this.match = null
        this.matchId = null
        this.matchIt = null,
        this.score = null
        this.home = this.away = {
            name: null,
            id: null,
            it: null,
            score: 0,
            ball: 0 // 让球
        }
    }
}

class ReaditMessage {
    constructor(messageType=null, topic=null, message=null, userHeaders=null) {
        this.messageType = messageType
        this.topic = topic
        this.message = message
        this.userHeaders = userHeaders
    }

    toString() {
        return "[ReaditMessage messageType=" + this.messageType + " message=" + this.message + " topic=" + this.topic + "]"
    }

    getMessage() {
        return this.message
    }

    getTopic() {
        return this.topic
    }

    getBaseTopic() {
        return this.topic.slice(this.topic.lastIndexOf('/') + 1)
    }

    getUserHeaders() {
        return this.userHeaders
    }

    isInitialTopicLoad() {
        return this.messageType == INITIAL_TOPIC_LOAD
    }

}

const getSessionId = async () => {
    var resp = await axios.get('/getSessionId')
    if(resp.data.length < 1) {
        return null
    }
    return resp.data.trim();
}


const handshakeCallback = (data) => {
    try {
        var i = data.split(HANDSHAKE_MESSAGE_DELIM)
        var r = i[0]
        var o = r.split(FIELD_DELIM)
        if (o[0] != HANDSHAKE_STATUS_CONNECTED) {
            return false
        }
        userConnectId = o[1].toString().substring(0, o[1].toString().length -1)
        isHandShake = true
        return true
    } catch (e) {
        return false
    }

}

const send_handshake_data = (ws, sessionId) => {
    var data = '\x23\x03\x50\x01' + '__time,S_' + sessionId + '\x00'
    ws.send(data)
}

const splitDataHandler = (strArray) => {
    var result = {}
    for (var x=0; x<strArray.length; x++) {
        var temp = strArray[x].split('=')
        if (temp.length >= 2) {
            result[temp[0]] = temp.slice(1).join('=')
        }
    }
    return result
}

const initInPlayDataHandler = (data) => {
    var dataEvent = data.getMessage().split('|')
    // 28 - 20
    for (var x=0; x<dataEvent.length; x++) {
        var dataArray = dataEvent[x].split(';')
        var dataClass = dataArray[0]
        var dataDict = splitDataHandler(dataArray.slice(1))
        try {
            switch(dataClass) {
                case 'CL':
                    // console.log('------分类：' + dataDict.NA + '-------')
                    if(dataDict.NA == '篮球') {
                        matchId = dataDict.ID
                    }
                    break
                case 'CT':
                    if (dataDict.ID != matchId) {
                        break
                    }
                    //console.log('联赛：' + dataDict.NA)
                    //console.log(dataDict)
                    var leagueName = dataDict.NA
                    var l_suffix = 'OV'
                    var r_suffix = 'C' + dataDict.ID + '_10_0'
                    var leagueId = dataDict.IT.slice(l_suffix.length, dataDict.IT.length - r_suffix.length)
                    leagueId = leagueId.replace(/\-/ig, ' ')
                    
                    matchData[leagueId] = {
                        id: leagueId,
                        it: dataDict.IT,
                        name: leagueName,
                        events: {}
                    }
                    break
                case 'EV':
                    var leagueId = dataDict.CC
                    leagueId = leagueId.replace(/\-/ig, ' ')
    
                    var leagueFlags = dataDict.ID.match(/C(\w+)A_10_0/)[1]
                    var l_suffix = 'OV'
                    var r_suffix = 'C' + leagueFlags + 'A_10_0'
                    var eventName = dataDict.NA
                    var eventId = dataDict.IT.slice(l_suffix.length, 
                        dataDict.IT.length - r_suffix.length )
                    var eventScore = dataDict.SS
                    var eventCP = dataDict.CP
                    var startStatus = dataDict.TT == '1'

                    for (var _leagueId in matchData) {
                        if(leagueId == _leagueId) {
                            //console.log('队伍：' + dataDict.NA)
                            //console.log(dataDict)
                            //debugger
                            //TM 剩余分钟
                            //TS 剩余秒
                            // TT = "0"  比赛停止  1比赛中
                            var time = parseInt(dataDict.TM) * 60 + parseInt(dataDict.TS)
                            var ts = '0' + time % 60;
                            var tm = '0' + Math.floor(time / 60);
                            ts = ts.substring(ts.length -2, ts.length)
                            tm = tm.substring(tm.length -2, tm.length)
                            matchData[leagueId].events[eventId] = {
                                id: dataDict.ID,
                                it: dataDict.IT,
                                name: eventName,
                                node: eventCP,
                                score: eventScore,
                                time: [tm, ts],
                                startStatus: startStatus,
                                markets: {},
                            }
                        }
                    }
                    break
                case 'MA':
                    var l_suffix = 'OV_'
                    var r_suffix = '_10_0'
                    var leagueFlags = dataDict.PC.slice(l_suffix.length, 
                        dataDict.PC.length - r_suffix.length)
    
                    var l_suffix = 'OV'
                    var r_suffix = 'C' + leagueFlags + '-' + dataDict.ID + '_10_0'
                    var eventId = dataDict.IT.slice(l_suffix.length, 
                        dataDict.IT.length - r_suffix.length)
    
                    var marketId = dataDict.FI
    
                    for (var leagueId in matchData) {
                        for(var _eventId in matchData[leagueId].events) {
                            if (eventId == _eventId) {
                                //console.log('MA：' + dataDict.NA)
                                //console.log(dataDict)
                                //console.log(dataEvent[x])
                                //console.log(dataArray.slice(1))
                                //debugger
                                matchData[leagueId].events[eventId].markets = {
                                    id: marketId,
                                    it: dataDict.IT,
                                    name: dataDict.NA,
                                    teams: {},
                                    teamsKey: [],
                                }
                            }
                        }
                    }
                    break
                case 'PA': // OR = 0 主队  1 客队
                    for (var leagueId in matchData) {
                        for(var eventId in matchData[leagueId].events) {
                            if (matchData[leagueId].events[eventId].markets.id == dataDict.FI) {
                                var teamId = dataDict.ID
                                var ball = parseFloat(dataDict.HA);
                                if (isNaN(ball)) {
                                    ball = 0
                                }
                                matchData[leagueId].events[eventId].markets.teams[teamId] = {
                                    id: dataDict.ID,
                                    name: dataDict.NA,
                                    ball: ball,
                                }

                                matchData[leagueId].events[eventId].markets.teamsKey.push(teamId);
                            }
                        }
                    }
                    break
                default:
                    break
            }
        } catch(e) {
            // console.log(e)
        }
    
    }

}

const serverInitDataHandler = (data) => {
    switch(data.getTopic()) {
        case '__time':
            break
        case 'CONFIG_10_0':
            break
        case 'XL_L10_Z0_C1_W1':
            // console.log(data.getMessage())
            break
        case 'Media_L10_Z0':
            // console.log(data.getMessage())
            break
        case 'OVInPlay_10_0':
            initInPlayDataHandler(data)
            //ws.send('\x16\x0015808657155M18_10_0\x01')
            break
        default:
            serverDataHandler(data)
            break
    }
}

var updateLock = false;

// 计时器
setInterval(()=> {
    if(updateLock) {true};

    for (var leagueId in matchData) {
        for(var eventId in matchData[leagueId].events) {
            var event = matchData[leagueId].events[eventId]
            if (event.startStatus) {
                var [tm, ts] = event.time
                var time = parseInt(tm) * 60 + parseInt(ts);
                if (time > 0) {
                    time -= 1;
                    ts = '0' + time % 60;
                    tm = '0' + Math.floor(time / 60);
                    ts = ts.substring(ts.length -2, ts.length)
                    tm = tm.substring(tm.length -2, tm.length)
                    matchData[leagueId].events[eventId].time = [tm, ts]
                }
            }
        }
    }
}, 1000);


const updateGameDataDict = (leagueId, eventId, data, dataDict) => {
    // OV80900874-104706929_10_0
    updateLock = true
    try {
        if ('SS' in dataDict) {
            matchData[leagueId].events[eventId].score = dataDict.SS
        }
    
        if ('CP' in dataDict) {
            matchData[leagueId].events[eventId].node = dataDict.CP
        }
        if ('TM' in dataDict) {
            matchData[leagueId].events[eventId].time[0] = dataDict.TM
        }
        if ('TS' in dataDict) {
            matchData[leagueId].events[eventId].time[1] = dataDict.TS 
        }
        if ('TM' in dataDict || 'TS' in dataDict) {
            var time = matchData[leagueId].events[eventId].time;
            time = parseInt(time[0]) * 60 + parseInt(time[1])
            var ts = '0' + time % 60;
            var tm = '0' + Math.floor(time / 60);
            ts = ts.substring(ts.length -2, ts.length)
            tm = tm.substring(tm.length -2, tm.length)
        }

        if ('TT' in dataDict) {
            matchData[leagueId].events[eventId].startStatus = dataDict.TT == '1'
            /*
            if(dataDict.TT == '1') {
                console.log(data.getBaseTopic(), '比赛中')
            } else {
                console.log(data.getBaseTopic(), '比赛暂停')
            }
            */
        }

        // console.log(dataDict)
        if ('VC' in dataDict) {
            /*
            var data_map = {
                1077 : '持有球权',    
                1074 : '2分球',   
                1075 : '3分球',   
                1078 : '罚球', 
                1079 : '罚球得分',  
                1080 : '罚球未中',   
                1081 : '暂停比赛',   
                1086 : '犯规',   
                1082 : '赛节结束',   
                1083 : '半场结束',   
                1084 : '比赛结束',   
                1085 : '加时赛',   
                1087 : '第1节',   
                1088 : '第2节',   
                1089 : '第3节',   
                1090 : '第4节',   
                1091 : '上半场',   
                1092 : '下半场',   
                1095 : '投篮未中(1095)',   
                1094 : '投篮未中(1094)'    
            }
            
            var temp = dataDict.VC.split('^')
            var out = []
            for(var x=0; x<temp.length; x++) {
                var key = temp[x].slice(1)
                out.push(temp[x].slice(0,1)+ data_map[key])
            }
            console.log(data.getBaseTopic(), out.join('^'))
            */
            if (updateGameDataCallback != null) {
                updateGameDataCallback(matchData)
            }

            if (updateGameEventInfoCallback != null) {
                // updateGameEventInfoCallback(matchData[leagueId].events[eventId].id, dataDict.VC)
                updateGameEventInfoCallback(leagueId, eventId, matchData[leagueId].events[eventId].id, dataDict.VC)
            }
           
        }
    } catch(e) {
        console.log(e)
    }
    updateLock = false;
    
    if (updateGameDataCallback != null) {
        updateGameDataCallback(matchData)
    }
    
}

const updateGameData = (data, dataDict) => {
    // 篮球
    // 15808657155M18_10_0
    var l_suffix = '15'
    var r_suffix = '5M' + matchId + '_10_0'

    var l_suffix2 = 'OV'
    var r_suffix2 = 'C' + matchId + 'A_10_0'

    for (var leagueId in matchData) {
        for(var eventId in matchData[leagueId].events) {
            var marketId = matchData[leagueId].events[eventId].markets.id
            var eventId = matchData[leagueId].events[eventId].id.replace('C' + matchId + 'A_10_0', '')

            if (data.getBaseTopic() == l_suffix + marketId + r_suffix) {
                updateGameDataDict(leagueId, eventId, data, dataDict)
            }else if (data.getBaseTopic() == l_suffix2 + eventId + r_suffix2) {
                updateGameDataDict(leagueId, eventId, data, dataDict)
            }
            
            // OV80900874-104706929_10_0
            for(var team in matchData[leagueId].events[eventId].markets.teams) {
                var teamId = matchData[leagueId].events[eventId].markets.teams[team].id
                if (data.getBaseTopic() == 'OV' + marketId + '-' + teamId +'_10_0') {
                    if ('HA' in dataDict) {
                        matchData[leagueId].events[eventId].markets.teams[team].ball = dataDict.HA
                    }
                }
            }
        }
    }
}

const deleteGameData = (data, dataDict) => {
    // OVInPlay_10_0/OV_18_10_0/OVB-ITASA2MC18_10_0/OV80636378C18A_10_0

    //OVInPlay_10_0/OV_18_10_0/OVB-URLIGWC18_10_0D|

    // 判断是篮球
    try {
        var temp = data.getTopic().split('/')
        if (temp[1].match(/OV_(\w+)_10_0/)[1] == matchId) {
            // 删除事件
            if (temp.length == 4) {
                var leagueIt = temp[2]
                for (var leagueId in matchData) {
                    if (matchData[leagueId].it == leagueIt) {
                        var l_suffix = 'OV'
                        var r_suffix = 'C' + matchId+ 'A_10_0'
                        var eventId = temp[3].slice(l_suffix.length, temp[3].length - r_suffix.length)
                        console.log('删除比赛:' + matchData[leagueId].events[eventId].name)
                        delete matchData[leagueId].events[eventId]
                    }
                }
            }
            // 删除比赛
            else if (temp.length == 3) {
                var leagueIt = temp[2]
                for (var leagueId in matchData) {
                    if (matchData[leagueId].it == leagueIt) {
                        console.log('删除联赛:' + matchData[leagueId].name)
                        delete matchData[leagueId]
                    }
                }
            }
            // 删除联赛分类
            else if (temp.length == 2) {
                matchData = {}
                console.log('清空联赛')
                
            }
        }
    } catch(e) {
        // console.log(e)
    }


    if (updateGameDataCallback != null) {
        updateGameDataCallback(matchData)
    }
}


const serverDataHandler_later2 = (data) => {
    // matchData

    var dataEvent = data.getMessage().split('|');
    var flags = dataEvent[0]
    
    var dataArray = dataEvent[1].split(';')
    var dataClass = dataArray[0]
    // var dataDict = splitDataHandler(dataArray.slice(1))
    var dataDict = splitDataHandler(dataArray)

    switch (flags) {
        case 'I': {
            //    var topic = data.getBaseTopic()
            //    topic.substring(0, topic.indexOf('_') - 1)
            /*
            switch(dataClass) {
                case 'EV':
                    //console.log(data.getMessage())
                    if(Object.keys(dataDict).indexOf('SS') > -1) {
                        var team = new Team()
                    }
                    
                case 'PA':
                
                default:
                    break
            }
            */
            break;
        }
        case 'D':{
            deleteGameData(data, dataDict)
            break;
        }
        case 'F':
        case 'U':{
            updateGameData(data, dataDict) 
            break
        }
        default:
            break;
    }
    
    if (updateGameDataCallback != null) {
        updateGameDataCallback(matchData)
    }
    
}

const serverDataHandler = (data) => {
    var i = data.topic
    var r = i.slice(i.lastIndexOf('_') + 1)
    switch(r) {
        case 'BAL':
            break
        case 'MSG':
            break
        default:
            serverDataHandler_later2(data)
            break
    }
}

const socketDataCallback = (data) => {
    if (data) {
        try {
            var n = data.split(MESSAGE_DELIM)
            while (n.length > 0) {
                var i = n.splice(0, 1)[0]
                var  messageType = i.charCodeAt(0)
                switch (messageType) {
                    case INITIAL_TOPIC_LOAD:
                        // 初始化游戏数据
                        var o = i.split(RECORD_DELIM)
                        var userHeaders = o[0].split(FIELD_DELIM)
                        var a = userHeaders.splice(0, 1)[0]
                        var topic = a.slice(1, )
                        var message = i.slice(o[0].length + 1)
                        serverInitDataHandler(new ReaditMessage(messageType, topic, message, userHeaders))
                        break

                    case DELTA: 
                        // 删除D 插入I 更新U
                        var o = i.split(RECORD_DELIM)
                        var userHeaders = o[0].split(FIELD_DELIM)
                        var a = userHeaders.splice(0, 1)[0]
                        var topic = a.slice(1, )
                        var message = i.slice(o[0].length + 1)
                        /*
                        if(message.match(/VC=11095|VC=.1094|VC=.1086/ig) != null) {
                            debugger
                        }*/

                        serverDataHandler(new ReaditMessage(messageType, topic, message, userHeaders))
                        break
                    case CLIENT_ABORT:
                    case CLIENT_CLOSE:
                        connectStatus = false
                        console.log("Connection close/abort message type sent from publisher. Message type: " + messageType)
                        break
                    default:
                        console.log("Unrecognised message type sent from publisher: " + messageType)
                        break
                }
            }

        } catch (e) {
            console.log(e)
        }
    }
}


module.startEvent = window.startEvent = async (sessionId, callback, infoCallback) => {
    updateGameDataCallback = callback
    updateGameEventInfoCallback = infoCallback
    connectStatus = false

    if (sessionId == null) {
        var sessionId = await getSessionId()
    }

    if (sessionId == null || sessionId == 'null' || sessionId.length == 0) {
        alert('获取赛事失败');
        return
    }

    if (ws) {
        try {
            ws.close()
        } catch(e) {

        }
    }

    var url = 'wss://premws-pt3.365lpodds.com/zap/?uid=' + Math.random().toString().substring(2)
    connectStatus = false
    ws = new WebSocket(url, 'zap-protocol-v1', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0'
        } 
    })
    
    ws.onopen = () => {
        isHandShake = false
        connectStatus = true
        send_handshake_data(ws, sessionId)
    }

    ws.onclose = () => {
        connectStatus = false
        lert('连接关闭了')
    }

    ws.onerror = () => {
        alert('连接失败')
    }
    
    ws.onmessage = (event) => {
        if (!isHandShake && handshakeCallback(event.data)) {
            // 发送初始化数据
            // CONFIG_10_0,HL_L10_Z0_C1_W1,HR_L10_Z0_C1_W1
            // ws.send('\x16\x00CONFIG_10_0,OVInPlay_10_0,Media_L10_Z0,XL_L10_Z0_C1_W1\x01')
            ws.send('\x16\x00CONFIG_10_0,OVInPlay_10_0\x01')
            // 进入某个比赛
            // ws.send('\x16\x006V80841448C18A_10_0\x01')
            // ws.send('\x16\x0015808657295M18_10_0\x01')
            return
        } else {
            socketDataCallback(event.data)
        }

        if (!connectStatus) {
            ws.close()
        }

    }

    window.openEvent = function(eventId, marketsId) {
        for(var x=0; x < 1; x++) {
            ws.send('\x16\x006V' + eventId + '\x01');
            ws.send('\x16\x0015' + marketsId + '5M18_10_0');
        }

    }

};

