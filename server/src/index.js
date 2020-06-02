const express = require('express')
const superagent = require('superagent')
const tokenUtil  = require('./tokenUtil')

const app = express()



app.use('/static', express.static('static'))


app.get('/', (req, res) => {
    res.redirect('./static/index.html', 301)
})

app.get('/getSessionId', async (req, resp) => {
    const session = superagent.agent();
    session
        .get('https://www.28365365.com/')
        .end((err, res) => {
            if(res.statusCode === 200) {
                try {
                    var nstToken = tokenUtil.getNstToken(res.text);
                    var wsToken = tokenUtil.B365SimpleEncrypt.decrypt(nstToken);
                    session
                        .get('https://www.28365365.com/defaultapi/sports-configuration')
                        .end((err, res) => {
                            try {
                                var sessionId = JSON.parse(res.text)['flashvars']['SESSION_ID'];
                                if(sessionId && wsToken) {
                                    resp.send({ fetchStatus: true, sessionId, wsToken });
                                } else {
                                    resp.send({ fetchStatus: false });
                                }
                                
                            } catch(err) {
                                resp.send({ fetchStatus: false });
                            }
                            
                        });
                } catch(err) {
                    resp.send({ fetchStatus: false });
                }
            } else {
                resp.send({ fetchStatus: false });
            }
        });
})


app.listen(5000, () => console.log('Example app listening on port 5000!'))