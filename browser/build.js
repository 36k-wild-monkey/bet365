// browserify index.js -o ../server/src/app.js
const browserify = require('browserify')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const urljoin = require('url-join')

config = {
    files: ['./src/app.js'],
    outDir: '../server/static',
    copyFiles: ['index.html'],
    copyDir: '../server/static',
    clearDir: '../server/static',
    replaceFlags: ['{ app.js }'],
    static: '/static',
}

function MD5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

const deleteFolder = function(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolder(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

browserify(config.files).bundle(async (err, src) => {
        if (err) {
            console.log(err)
        } else {
            deleteFolder(config.clearDir)
            await fs.mkdirSync(config.copyDir)
            var appFileName = 'app.' + MD5(src) + '.js'
            appFile = path.join(config.outDir, appFileName)
            try {
                await fs.writeFileSync(appFile, src)
            } catch(e) {
                console.log(e)
                return
            } finally {
                console.log('copy files:');
                for(var x in config.copyFiles) {
                    console.log('  ' + config.copyFiles[x])
                    try {
                        var filename = path.join(
                            config.copyDir,
                            path.basename(config.copyFiles[x])
                        )
                        var buffer = await fs.readFileSync(config.copyFiles[x]).toString()
                        for(var x in config.replaceFlags) {
                            
                            buffer = buffer.replace(config.replaceFlags[x], urljoin(config.static, appFileName))
                        }
                        await fs.writeFileSync(filename, buffer, {flag: 'w'})
                    } catch(e) {
                        console.log(e)
                        console.log('copy file error: ' + config.copyFiles[x])
                        return
                    }
                }

                console.log('copy to:')
                for(var x in config.copyFiles) {
                    console.log('  ' + path.join(config.copyDir, config.copyFiles[x]))
                }
                
                console.log('\ncomplie files:');
                for(var x in config.files) {
                    console.log('  ' + config.files[x])
                }
                console.log('outDir:')
                console.log('  ' + appFile)
            }
        }
    })
    .on("error", function (err) { console.log("Error: " + err.message); })