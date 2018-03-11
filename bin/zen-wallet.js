#!/usr/bin/env node

const proc = require('child_process');
const path = require('path');

let wallet;
let argsArray = ['start']

if (process.argv.indexOf('wipe') > -1) { argsArray.push('wipe') }
if (process.argv.indexOf('miner') > -1) { argsArray.push('miner') }

wallet = proc.spawn('npm', argsArray, { cwd: path.join(__dirname,'../') });

wallet.stdout.pipe(process.stdout);
wallet.stderr.pipe(process.stderr);

wallet.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
  process.exit(code);
});
