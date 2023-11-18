const { spawn } = require('child_process');

let command, args;
if (process.platform === 'win32') {
  command = 'yarn.cmd'; // Windows
  args = ['start'];
} else {
  command = 'yarn'; // macOS and Linux
  args = ['start'];
}
const keywords = ['[ERROR] - [Error: Not connected]', "[WARN] - [Attempt 4 at generating auth key failed]"]; // 指定的关键词列表

let proc = null;

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

    if (checkKeywords(error) || checkCrash(error)) {
      restartCommand();
    }
  });

  proc.on('close', (code) => {
    console.error(`进程退出，退出码：${code}`);
    restartCommand();
  });
}

process.on("exit", function () {
  require("child_process").spawn(process.argv.shift(), process.argv, {
    cwd: process.cwd(),
    detached: true,
    stdio: "inherit"
  });
});

function restartCommand() {
  proc.killed || proc.kill();
  console.log('等待5秒后重新启动命令...');
  setTimeout(()=>{
    process.exit(0)
  },5000)
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
