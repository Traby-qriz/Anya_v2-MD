const cluster = require('cluster');
const path = require('path');
const fs = require('fs');

let isRunning = false;
let worker = null;

/**
 * Start a js file
 * @param {String} file `path/to/file`
 */
function start(file) {
    if (isRunning) return;
    isRunning = true;
    let args = [path.join(__dirname, file), ...process.argv.slice(2)];
    cluster.setupMaster({
        exec: path.join(__dirname, file),
        args: args.slice(1),
    });
    worker = cluster.fork();
    worker.on('message', (data) => {
        console.log('[RECEIVED]', data);
        switch (data) {
            case 'reset':
                worker.send('resetting');
                worker.once('exit', () => {
                    start(file);
                });
                break;
            case 'reload':
                //console.log('Received reload command');
                worker.send('reloading');
                worker.once('exit', () => {
                    start(file);
                });
                break;
        }
    });
    worker.on('exit', (code) => {
        isRunning = false;
        console.error('Worker exited with code:', code);
        if (code !== 0) {
            fs.watchFile(args[0], () => {
                fs.unwatchFile(args[0]);
                start(file);
            });
        }
    });
}

start('./index.js');
