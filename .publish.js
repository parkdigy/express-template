const ll = console.log;

const exec = require('child_process').exec;

const isWin = process.platform === 'win32';
const mode = process.env.NODE_ENV;
const modeBranchName = `publish/${mode}`;

if (!['development', 'staging', 'production'].includes(mode)) {
  ll('Invalid mode :', mode);
  return;
}

const publishBranch = (publishBranchName, mergeFromBranchName, callback) => {
  const commands = [
    `git checkout ${publishBranchName}`,
    'git remote update',
    'git pull',
    { command: `git merge -X theirs ${mergeFromBranchName}`, skipError: true },
    isWin
      ? `(Get-Content .gitignore) -replace '#PUB#', '' | Set-Content .gitignore`
      : `sed -i '' 's/#PUB#//g' .gitignore`,
    'git add .',
    'npm run reset:gitignore',
    {
      command: isWin
        ? 'cmd /V /C "set "GIT_EDITOR=true" && git merge --continue"'
        : 'GIT_EDITOR=true git merge --continue',
      skipError: true,
    },
    `git push origin ${publishBranchName}`,
    `git checkout ${mergeFromBranchName}`,
  ];

  const runCommand = (index) => {
    if (index >= commands.length) {
      callback && callback(true);
      return;
    }

    const commandInfo = commands[index];
    let command;
    let skipError = false;
    if (typeof commandInfo === 'string') {
      command = commandInfo;
    } else {
      command = commandInfo.command;
      skipError = commandInfo.skipError;
    }

    ll(`\$ ${command}`);
    exec(command, (err, stdout, stderr) => {
      if (!skipError && err) {
        ll('ERROR!!!', err);
        callback && callback(false);
        return;
      }

      runCommand(index + 1);
    });
  };

  runCommand(0);
};

exec('git branch', (err, stdout, stderr) => {
  if (err) {
    ll(err);
    return;
  }

  let currentBranch = undefined;

  stdout.split('\n').find((branch) => {
    if (branch.indexOf('* ') === 0) {
      currentBranch = branch.substr(2).trim();
      return true;
    }
  });

  if (!currentBranch) {
    ll('Cannot find current branch');
    return;
  }

  if (mode === 'production' && currentBranch !== 'main' && currentBranch !== 'master') {
    ll('production 배포는 main 또는 master 브랜치에서만 가능합니다.');
    return;
  }

  publishBranch(modeBranchName, currentBranch, (success) => {
    if (success) {
      ll('Publish success');
    } else {
      ll('Publish failed!!!');
    }
  });
});
