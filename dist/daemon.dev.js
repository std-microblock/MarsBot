"use strict";

var _require = require('child_process'),
    spawn = _require.spawn;

var command, args;

if (process.platform === 'win32') {
  command = 'yarn.cmd'; // Windows

  args = ['start'];
} else {
  command = 'yarn'; // macOS and Linux

  args = ['start'];
}

var keywords = ['Error: Not connected', 'Disconnecting...', "[WARN] - [Attempt 4 at generating auth key failed]", "[Reconnect] Closing current connection"]; // 指定的关键词列表

var proc = null;
var stdErr = "";

var reportErrorToGroup = function reportErrorToGroup(error) {
  var retry,
      _args = arguments;
  return regeneratorRuntime.async(function reportErrorToGroup$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          retry = _args.length > 1 && _args[1] !== undefined ? _args[1] : 3;
          _context.next = 3;
          return regeneratorRuntime.awrap(fetch("https://v1.nocodeapi.com/microblock/telegram/ZXzrjQwUtCndXvvf/sendText?text=" + encodeURIComponent('@simulated_annealing\n[MarsBot Daemon Error] ' + error), {
            method: 'POST',
            redirect: 'follow'
          }).then(function (v) {
            return v.json();
          })["catch"](function (err) {
            console.log('Failed to report error', error, 'due to', err, 'retry:', retry);

            if (retry > 0) {
              reportErrorToGroup(error, retry - 1);
            }
          }));

        case 3:
        case "end":
          return _context.stop();
      }
    }
  });
};

function startCommand() {
  proc = spawn(command, args);
  proc.stdout.on('data', function (data) {
    var output = data.toString();
    console.log(output); // 输出到控制台

    if (checkKeywords(output) || checkCrash(output)) {
      restartCommand();
    }
  });
  proc.stderr.on('data', function (data) {
    var error = data.toString();
    console.error(error); // 输出错误到控制台

    stdErr += error;

    if (checkKeywords(error) || checkCrash(error)) {
      restartCommand();
    }
  });
  process.stdin.pipe(proc.stdin);
  proc.on('close', function (code) {
    console.error("\u8FDB\u7A0B\u9000\u51FA\uFF0C\u9000\u51FA\u7801\uFF1A".concat(code));

    if (stdErr.includes('AUTH_KEY_DUPLICATED')) {
      reportErrorToGroup('账号被踢，请手动重新登录，机器人将不会自动重启').then(function () {});
    } else {
      restartCommand();
    }
  });
} // process.on("exit", function () {
//   require("child_process").spawn(process.argv.shift(), process.argv, {
//     cwd: process.cwd(),
//     detached: true,
//     stdio: "overlapped"
//   });
// });


function restartCommand() {
  proc.killed || proc.kill();
  stdErr = "";
  console.log("清理 Puppeteer 残留物...");
  spawn('powershell', ['/Command', "rm -R C:\\Users\\MicroBlock\\AppData\\Local\\Temp\\puppeteer_*"]);
  console.log('等待5秒后重新启动命令...');
  setTimeout(function () {
    process.exit(0);
  }, 5000);
}

function checkKeywords(output) {
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = keywords[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var keyword = _step.value;

      if (output.includes(keyword)) {
        return true;
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator["return"] != null) {
        _iterator["return"]();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return false;
}

function checkCrash(output) {
  return false;
}

startCommand();