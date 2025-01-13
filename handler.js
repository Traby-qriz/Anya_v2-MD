const cluster = require('cluster');
const path = require('path');
const fs = require('fs');

let isRunning = false;

/**
 * Start a JS file
 * @param {String} file Path to the file
 */
function start(file) {
    if (isRunning) return;
    isRunning = true;
    let args = [path.join(__dirname, file), ...process.argv.slice(2)];
    cluster.setupMaster({
        exec: path.join(__dirname, file),
        args: args.slice(1),
    });
    let worker = cluster.fork();
    worker.on('message', (data) => {
        console.log('[RECEIVED]', data);
        switch (data) {
            case 'reload':
                console.log('Reloading...');
                reload(file);
                break;
            case 'uptime':
                worker.send(process.uptime());
                break;
        }
    });
    worker.on('exit', (code) => {
        isRunning = false;
        console.error('Exited with code:', code);
        if (code === 0) return;
        fs.watchFile(args[0], () => {
            fs.unwatchFile(args[0]);
            start(file);
        });
    });
}

/**
 * Reload the app without resetting other commands.
 * @param {String} file Path to the file
 */
function reload(file) {
    if (!isRunning) return start(file);
    const oldWorker = Object.values(cluster.workers)[0];
    const newWorker = cluster.fork();
    newWorker.on('listening', () => {
        oldWorker.kill();
        console.log('Reload complete.');
    });
    newWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error('New worker failed, keeping the old one running.');
        }
    });
}

start('./index.js');
