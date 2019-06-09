const axios = require('axios')

exports.getSessionId = async () => {
    try {
        var resp = await axios.get('https://www.838365.com', {
            headers: {
                'Host': 'www.838365.com',
                'referer': 'https://www.838365.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0'
            },
            withCredentials: true
        })
        var cookies = resp.headers['set-cookie']
        for(x in cookies) {
            var result = cookies[x].match(/pstk=(\w+)/)
            if(result && result.length >= 2) {
                return result[1]
            }
    
        }
    } catch(e) {

    }

    return ''
}
