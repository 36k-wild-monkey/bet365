const express = require('express')
const superagent = require('superagent')
const tokenUtil  = require('./tokenUtil')

const app = express()


var base_url = 'https://www.28365365.com';

app.use('/static', express.static('static'))


app.get('/', (req, res) => {
    res.redirect('./static/index.html', 301)
})

app.get('/getSessionId', async (req, resp) => {
    const session = superagent.agent();
    session
        .get(base_url)
        .end((err, res) => {
            if(res.statusCode === 200) {
                try {
                    // var nstToken = tokenUtil.getNstToken(res.text);
                    var nstToken = 'QcQlYA==.z2kQfBEbUtwhWdIVM7DxT5eE5l1JjmZn8Lh4aPhZ5SI=';
                    // var wsToken = tokenUtil.B365SimpleEncrypt.decrypt(nstToken);
                    var wsToken = nstToken
                    session
                        .get(base_url + '/defaultapi/sports-configuration')
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

var port = 5001;
app.listen(port, () => console.log('Example app listening on port ' + port + '!'))