/**
 * API for writing to the freezer control log.
 */


const fs = require('fs');
const os = require('os');
const util = require('util');
const path = require('path');
const config = require('./config');

const fs_open = util.promisify(fs.open);
const fs_write = util.promisify(fs.write);
const fs_close = util.promisify(fs.close);

// for the keezer control log
var controlLogFd = null;
var controlLog = [];
var writingControlLog = false;
var openWaiting = false;
var drainPromise = null;

/*
On Windows: 
os.homedir()=C:\Users\dburk
os.tmpdir()=C:\Users\dburk\AppData\Local\Temp
process.env={"ALLUSERSPROFILE":"C:\\ProgramData","APPDATA":"C:\\Users\\dburk\\AppData\\Roaming","CommonProgramFiles":"C:\\Program Files\\Common Files","CommonProgramFiles(x86)":"C:\\Program Files (x86)\\Common Files","CommonProgramW6432":"C:\\Program Files\\Common Files","COMPUTERNAME":"DESKTOP-AMNM96H","ComSpec":"C:\\WINDOWS\\system32\\cmd.exe","DriverData":"C:\\Windows\\System32\\Drivers\\DriverData","FPS_BROWSER_APP_PROFILE_STRING":"Internet Explorer","FPS_BROWSER_USER_PROFILE_STRING":"Default","GOOGLE_API_KEY":"no","GOOGLE_DEFAULT_CLIENT_ID":"no","GOOGLE_DEFAULT_CLIENT_SECRET":"no","HOMEDRIVE":"C:","HOMEPATH":"\\Users\\dburk","LOCALAPPDATA":"C:\\Users\\dburk\\AppData\\Local","LOGONSERVER":"\\\\DESKTOP-AMNM96H","NUMBER_OF_PROCESSORS":"4","OneDrive":"C:\\Users\\dburk\\OneDrive","OS":"Windows_NT","Path":"C:\\WINDOWS\\system32;C:\\WINDOWS;C:\\WINDOWS\\System32\\Wbem;C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\;C:\\WINDOWS\\System32\\OpenSSH\\;C:\\Program Files (x86)\\Common Files\\Intuit\\QBPOSSDKRuntime;C:\\Program Files (x86)\\GitExtensions\\;C:\\Program Files\\Git\\cmd;C:\\Program Files\\PuTTY\\;C:\\Program Files\\nodejs\\;C:\\Users\\dburk\\AppData\\Local\\Microsoft\\WindowsApps;;C:\\Users\\dburk\\AppData\\Local\\Programs\\Microsoft VS Code\\bin;C:\\Users\\dburk\\AppData\\Roaming\\npm","PATHEXT":".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC","PROCESSOR_ARCHITECTURE":"AMD64","PROCESSOR_IDENTIFIER":"Intel64 Family 6 Model 142 Stepping 9, GenuineIntel","PROCESSOR_LEVEL":"6","PROCESSOR_REVISION":"8e09","ProgramData":"C:\\ProgramData","ProgramFiles":"C:\\Program Files","ProgramFiles(x86)":"C:\\Program Files (x86)","ProgramW6432":"C:\\Program Files","PROMPT":"$P$G","PSModulePath":"C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules\\","PUBLIC":"C:\\Users\\Public","SESSIONNAME":"Console","SystemDrive":"C:","SystemRoot":"C:\\WINDOWS","TEMP":"C:\\Users\\dburk\\AppData\\Local\\Temp","TMP":"C:\\Users\\dburk\\AppData\\Local\\Temp","USERDOMAIN":"DESKTOP-AMNM96H","USERDOMAIN_ROAMINGPROFILE":"DESKTOP-AMNM96H","USERNAME":"dburk","USERPROFILE":"C:\\Users\\dburk","windir":"C:\\WINDOWS"}

On Raspbian when running in systemd:
Oct  3 21:04:21 beer-pi nodejs[10458]: os.homedir()=/home/pi
Oct  3 21:04:21 beer-pi nodejs[10458]: os.tmpdir()=/tmp
Oct  3 21:04:21 beer-pi nodejs[10458]: process.cwd()=/
Oct  3 21:04:21 beer-pi nodejs[10458]: process.env={"LANG":"en_US.UTF-8","LANGUAGE":"en_US.UTF-8","PATH":"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin","HOME":"/home/pi","LOGNAME":"pi","USER":"pi","SHELL":"/bin/bash","INVOCATION_ID":"59ad449d365d4348a0e5282e58ac0fb0","JOURNAL_STREAM":"8:862017"}

TODO try to open control log file at 
1) os.homedir()/beer-pi/control.log
2) os.tmpdir()/beer-pi/control.log


*/

var logPaths = [
  os.homedir() + path.sep + "beer-pi" + path.sep + "control.log",
  os.tmpdir() + path.sep + "beer-pi" + path.sep + "control.log",
];

var pathIndex = 0;


/**
 * Starts the async process of opening the control log file.
 */
function openControlLog() {
  function failed(err) {
    console.log("Attempt to open " + logPaths[pathIndex] + " for control log failed with: " + JSON.stringify(err));
    if (++pathIndex < logPaths.length) {
      openWaiting = false;
      openControlLog();
    }
  }

  if (!openWaiting && controlLogFd==null) {
    openWaiting = true;
    createPath(logPaths[pathIndex], function (err) {
      if (err != null) {
        failed(err);
      } else {
        fs.open(logPaths[pathIndex], 'a', function (err, fd) {
          if (err != null) {
            failed(err);
          } else {
            console.log("Successfully opened " + logPaths[pathIndex] + " for control log");
            controlLogFd = fd;
          }
        });
      }
    });
  }
}

function createPath(path, callback) {
  parsedPath = path.parse(path);
  parsedParent = path.parse(parsedPath.dir);
  if (!fs.existsSync(parsedPath.dir)) {
    if (!fs.existsSync(parsedParent.dir)) {
      createPath(parsedPath.dir);
    } else {
      // tODO DEB create the directory
    }
  }
}

function addControlLog(message) {
  // only add the message if we are not draining or we have not finished draining
  if (drainPromise == null || controlLog.length > 0) {
    controlLog.push(message);
    writeToControlLogFile();
  }
}

function closeControlLog() {
  function nullFd() {
    controlLogFd = null;
  }
  return drain()
    .then(function () {
      return fs_close(controlLogFd);
    })
    .then(nullFd, nullFd);
}

/**
 * Returns a promise that has two effects: 
 * 1) Its existence will put the logger into drain mode so that once the logger buffer is empty, the logger
 *    will not accept any additional messages
 * 2) It will be resolved once the buffer has been emptied
 */
function drain() {
  if (drainPromise == null) {
    var myResolve;
    var myReject;
    drainPromise = new Promise(function (resolve, reject) {
      myResolve = resolve;
      myReject = reject;
    });
    drainPromise.myResolve = myResolve;
    drainPromise.myReject = myReject;
  }
  return drainPromise;
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
    } else if (drainPromise != null) {
      drainPromise.myResolve();
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