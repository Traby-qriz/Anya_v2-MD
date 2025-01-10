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
        if (data === 'reset') {
            worker.kill();
            isRunning = false;
            start(file);
        }
        if (data === 'uptime') {
            worker.send(process.uptime());
        }
        if (data === 'reload') {
            reload(file);
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

/**
 * Reload the worker process
 * @param {String} file `path/to/file`
 */
function reload(file) {
    console.log('Reloading worker...');
    const newWorker = cluster.fork();
    newWorker.on('listening', () => {
        console.log('New worker is ready');
        if (worker) {
            worker.kill();
        }
        worker = newWorker;
    });
    newWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error('New worker failed to start, exiting with code:', code);
        }
    });
}

start('./index.js');
