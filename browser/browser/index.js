

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
    for (x in strArray) {
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
    for (x in dataEvent) {
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
                    console.log('联赛：' + dataDict.NA)
                    console.log(dataDict)
                    var leagueName = dataDict.NA
                    var l_suffix = 'OV'
                    var r_suffix = 'C' + dataDict.ID + '_10_0'
                    var leagueId = dataDict.IT.slice(l_suffix.length, dataDict.IT.length - r_suffix.length)
                    leagueId = leagueId.replace(/\-/ig, ' ')
                    
                    matchData[leagueId] = {
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
                    var eventTime = dataDict.TU
                    var eventCP = dataDict.CP
    
                    for (_leagueId in matchData) {
                        if(leagueId == _leagueId) {
                            console.log('队伍：' + dataDict.NA)
                            console.log(dataDict)
                            //TM 剩余分钟
                            //TS 剩余秒
                            // TT = "0"  比赛停止  1比赛中
                            matchData[leagueId].events[eventId] = {
                                id: dataDict.ID,
                                name: eventName,
                                node: eventCP,
                                score: eventScore,
                                time: eventTime,
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
    
                    for (leagueId in matchData) {
                        for(_eventId in matchData[leagueId].events) {
                            if (eventId == _eventId) {
                                console.log(dataDict)
                                matchData[leagueId].events[eventId].markets = {
                                    id: marketId,
                                    name: dataDict.NA,
                                    teams: {}
                                }
                            }
                        }
                    }
                    break
                case 'PA': // OR = 0 主队  1 客队
                    for (leagueId in matchData) {
                        for(eventId in matchData[leagueId].events) {
                            if (matchData[leagueId].events[eventId].markets.id == dataDict.FI) {
                                var teamId = dataDict.ID
                                console.log('队伍名2：' + dataDict.NA)
                                console.log(matchData[leagueId].events[eventId].markets.teams)
                                matchData[leagueId].events[eventId].markets.teams[teamId] = {
                                    id: dataDict.ID,
                                    name: dataDict.NA,
                                    ball: parseFloat(dataDict.HA),
                                }
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
            break
        default:
            break
    }
}

const serverDataHandler_later2 = (data) => {
    // matchData

    var dataEvent = data.getMessage().split('|');
    var flags = dataEvent[0]
    
    var dataArray = dataEvent[1].split(';')
    var dataClass = dataArray[0]
    var dataDict = splitDataHandler(dataArray.slice(1))

    switch (flags) {
        case 'I':
            
            //    var topic = data.getBaseTopic()
            //    topic.substring(0, topic.indexOf('_') - 1)
        
            switch(dataClass) {
                case 'EV':
                    console.log(data.getMessage())
                    if(Object.keys(dataDict).indexOf('SS') > -1) {
                        var team = new Team()
                    }
                    
                case 'PA':
                
                default:
                    break
            }
            break;
        case 'D':
            // OVInPlay_10_0/OV_18_10_0/OVB-ITASA2MC18_10_0/OV80636378C18A_10_0

            //OVInPlay_10_0/OV_18_10_0/OVB-URLIGWC18_10_0D|

            var temp = data.getTopic().split('/')
            // 判断是篮球
            if (temp[1].match(/OV_(\w+)_10_0/)[1] == matchId) {
                try {
                    // 删除事件
                    if (temp.length == 4) {
                        var leagueIt = temp[2]
                        for (var leagueId in matchData) {
                            if (matchData[leagueId].it == leagueIt) {
                                var l_suffix = 'OV'
                                var r_suffix = 'C' + matchId+ 'A_10_0'
                                var eventId = temp[3].slice(l_suffix.length, temp[3].length - r_suffix.length)
                                delete matchData[leagueId].events[eventId]
                                console.log('删除事件:' + matchData[leagueId].events[eventId].name)
                            }
                        }
                    }
                    // 删除比赛
                    else if (temp.length == 3) {
                        var leagueIt = temp[2]
                        for (var leagueId in matchData) {
                            if (matchData[leagueId].it == leagueIt) {
                                delete matchData[leagueId]
                                console.log('删除比赛:' + matchData[leagueId].name)
                            }
                        }
                    }
                    // 删除联赛分类
                    else if (temp.length == 2) {
                        matchData = {}
                        console.log('清空联赛')
                    }

                } catch(e) {
                    console.log(e)
                }

            }
            break;
        case 'U':
            // 篮球
            if ('SS' in dataDict) {
                console.log(data.getTopic(), data.getMessage())
            }
            var l_suffix = 'OV'
            var r_suffix = 'C' + matchId+ 'A_10_0'
            if (data.getBaseTopic().indexOf(l_suffix) == 0 && data.getBaseTopic().lastIndexOf(r_suffix) == data.getBaseTopic().length - r_suffix.length) {
                var eventId = data.getBaseTopic().slice(l_suffix.length, data.getBaseTopic().length - r_suffix.length)
                for (leagueId in matchData) {
                    for(_eventId in matchData[leagueId].events) {
                        if (eventId == _eventId) {
                            if ('SS' in dataDict) {
                                matchData[leagueId].events[eventId].score = dataDict.SS
                                console.log(matchData[leagueId].events[eventId].name + ': ' + dataDict.SS)
                            }
                        }
                    }
                }
                
            }
            break;
        default:
            break;
    }

    /*
    if(data.message.slice(0, 1) == 'I' || data.message.slice(0, 1) == 'D') {
        
    }
    */
    
    // console.log(data.getTopic(), data.getMessage())
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
                        serverDataHandler(new ReaditMessage(messageType, topic, message, userHeaders))
                        break
                    case CLIENT_ABORT:
                    case CLIENT_CLOSE:
                        connectStatus = false
                        console.log("Connection close/abort message type sent from publisher. Message type: " + r)
                        break
                    default:
                        console.log("Unrecognised message type sent from publisher: " + r)
                        break
                }
            }

        } catch (e) {
            console.log(e)
        }
    }
}

(main = async () => {

    connectStatus = false
    var sessionId = await getSessionId()
    var url = 'wss://premws-pt3.365lpodds.com/zap/?uid=' + Math.random().toString().substring(2)
    var ws = new WebSocket(url, 'zap-protocol-v1', {
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
        setTimeout(main, 1);
    }

    ws.onerror = () => {
        console.log('连接失败')
    }
    
    ws.onmessage = (event) => {
        if (!isHandShake && handshakeCallback(event.data)) {
            // 发送初始化数据
            // CONFIG_10_0,HL_L10_Z0_C1_W1,HR_L10_Z0_C1_W1
            // ws.send('\x16\x00CONFIG_10_0,OVInPlay_10_0,Media_L10_Z0,XL_L10_Z0_C1_W1\x01')
            ws.send('\x16\x00CONFIG_10_0,OVInPlay_10_0\x01')
            return
        } else {
            socketDataCallback(event.data)
        }

        if (!connectStatus) {
            ws.close()
        }

    }

})();

