const { spawn } = require('child_process');

let command, args;
if (process.platform === 'win32') {
  command = 'yarn.cmd'; // Windows
  args = ['start'];
} else {
  command = 'yarn'; // macOS and Linux
  args = ['start'];
}
const keywords = ['Error: Not connected','Disconnecting...', "[WARN] - [Attempt 4 at generating auth key failed]","[Reconnect] Closing current connection"]; // 指定的关键词列表

let proc = null;
let stdErr = "";

const reportErrorToGroup = async (error, retry = 3) => {
  await ((fetch("https://v1.nocodeapi.com/microblock/telegram/ZXzrjQwUtCndXvvf/sendText?text=" + encodeURIComponent('@simulated_annealing\n[MarsBot Daemon Error] ' + error), {
    method: 'POST',
    redirect: 'follow',
  }).then(v => v.json())).catch(err => {
    console.log('Failed to report error', error, 'due to', err, 'retry:', retry)
    if (retry > 0) {
      reportErrorToGroup(error, retry - 1)
    }
  }))
}
function startCommand() {
  proc = spawn(command, args);
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output); // 输出到控制台

    if (checkKeywords(output) || checkCrash(output)) {
      restartCommand();
    }
  });
  proc.stderr.on('data', (data) => {
    const error = data.toString();
    console.error(error); // 输出错误到控制台
    stdErr += error;

    if (checkKeywords(error) || checkCrash(error)) {
      restartCommand();
    }
  });

  process.stdin.pipe(proc.stdin)

  proc.on('close', (code) => {
    console.error(`进程退出，退出码：${code}`);
    if (stdErr.includes('AUTH_KEY_DUPLICATED')) {
      reportErrorToGroup('账号被踢，请手动重新登录，机器人将不会自动重启').then(() => {
      })
    } else {
      restartCommand();
    }
  });
}

// process.on("exit", function () {
//   require("child_process").spawn(process.argv.shift(), process.argv, {
//     cwd: process.cwd(),
//     detached: true,
//     stdio: "overlapped"
//   });
// });

function restartCommand() {
  proc.killed || proc.kill();
  stdErr = "";
  console.log("清理 Puppeteer 残留物...")
  spawn('powershell', ['/Command', 'rm -R C:\\Users\\MicroBlock\\AppData\\Local\\Temp\\puppeteer_*'])
  console.log('等待5秒后重新启动命令...');
  setTimeout(() => {
    process.exit(0)
  }, 5000)
}

function checkKeywords(output) {
  for (const keyword of keywords) {
    if (output.includes(keyword)) {
      return true;
    }
  }
  return false;
}

function checkCrash(output) {
  return false;
}

startCommand();