/**
 * API for writing to the freezer control log.
 */


const fs = require('fs');
const util = require('util');

const fs_open = util.promisify(fs.open);
const fs_write = util.promisify(fs.write);
const fs_close = util.promisify(fs.close);

// for the keezer control log
var controlLogFd = null;
var controlLog = [];
var writingControlLog = false;
var drainComplete = null;


function openControlLog() {
  if (controlLogFd != null) {
    return new Promise.resolve();
  }
  return fs_open("./keezer.log", "a")
    .then(function (fd) {
      controlLogFd = fd;
      writeToControlLogFile();
    })
    .catch(function (err) {
      controlLogFd = null;
      return err;
    });
}

function addControlLog(message) {
  // only add the message if we are not draining or we have not finished draining
  if (drainComplete == null || controlLog.length > 0) {
    controlLog.push(message);
    writeToControlLogFile();
  }
}

function closeControlLog() {
  return drain()
    .then(function () {
      return fs_close(controlLogFd);
    })
    .finally(function () {
      controlLogFd = null;
    })
}

function drain() {
  return new Promise(function (resolve, reject) {
    drainComplete = resolve;
  });
}

function writeToControlLogFile() {
  if (writingControlLog || controlLog.length == 0 || controlLogFd == null) {
    // check back in one second...
    setTimeout(writeToControlLogFile, 1000);
    return;
  }

  writingControlLog = true;
  var message = controlLog.shift();
  fs.write(controlLogFd, message, function (error, bytesWritten, messageWritten) {
    writingControlLog = false;
    if (error) {
      console.log({ ERROR: "writeToControlLogFile() failed", error: error });
    }
    if (controlLog.length > 0) {
      setTimeout(writeToControlLogFile, 0);
    } else if (drainComplete!=null) {
      drainComplete();
    } else {
      // check back in one second...
      setTimeout(writeToControlLogFile, 1000);
    }
  });

}

module.exports = {
  openControlLog: openControlLog,
  addControlLog: addControlLog,
  closeControlLog: closeControlLog
}