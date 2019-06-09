const express = require('express')
const fs = require('fs')
const utils = require('./utils')
const path = require('path')

const app = express()



app.use('/static', express.static(path.join(__dirname, '../static')))

app.get('/', (req, res) => {
    res.redirect('./static/index.html')
})

app.get('/getSessionId', async (req, res) => {
    if(!await fs.existsSync('./sessionId')) { 
        var sessionId = await utils.getSessionId()
        await fs.writeFileSync('./sessionId', new Date().getTime() + '----' + sessionId);
        res.send(sessionId);
    } else {
        var content = await fs.readFileSync('./sessionId').toString().split('----');
        var lastTime = parseInt(content[0])
        var nowTime = new Date().getTime()
        if (content[1] == "" || nowTime - lastTime > 60000 * 30) { // 半个小时
            var sessionId = await utils.getSessionId()
            await fs.writeFileSync('./sessionId', new Date().getTime() + '----' + sessionId);
            res.send(sessionId);
        } else {
            res.send(content[1]);
        }
    }
})


app.listen(3000, () => console.log('Example app listening on port 3000!'))