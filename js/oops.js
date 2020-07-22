#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js -- "$0" "$@"
  const usage = `Put a useful comment here`;
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option( 'argument', { alias: 'a', type: 'boolean', description: 'what arg is used for' })
.argv;
const fs = require('fs');
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');

let logs = [];

const logSameLine = (line) => {
  logs.push(line);
  const trimLine = line.substring(0, 120);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(trimLine);
}

const staticLog = (line) => {
  logs.push(line);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  console.log(line);
}

const moveIt = (src, dest) => {
  if (fs.existsSync(src)){
    logSameLine(`Moving ${src.trim()} back to "${dest}"`)
    const destFolder = dest.substring(0,dest.lastIndexOf('/'));
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    fs.renameSync(src, dest);
  } else staticLog(`${src} missing`);
}

const deleteEmptyFolders = (folder) => {
  let files = fs.readdirSync(folder);
  if (!files.length) {
    logSameLine(`Deleting ${folder}`);
    fs.rmdirSync(folder);
    return true
  } else {
    files.forEach((fileName) => {
      const fullPath = `${folder}/${fileName}`;
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()){
        const deleted = deleteEmptyFolders(fullPath);
        if (deleted) {
          files = files.filter(f=>f!==fileName);
        }
      }
    });

    if (!files.length) {
      logSameLine(`Deleting ${folder}`);
      fs.rmdirSync(folder);
      return true;
    }
    return false;
  }
}

(async () => {
  // Do what you do
  const undoFile = fs.readFileSync('/mnt/f/Photography/undothis.txt', 'utf-8');
  const toBeUndone = undoFile.split('\n');

  toBeUndone.forEach(line => {
    const [left, movedTo] = line.split(' -> ');
    const orig = left.substring(5);
    moveIt(movedTo.trim(), orig.trim());
  });

  deleteEmptyFolders('/mnt/f/Photography');
  fs.appendFileSync('/mnt/f/Photography/undone.log', `\n** New Log ${Date.now()}\n${logs.join('\n')}`, 'utf-8');
})();

// vim: ft=javascript

