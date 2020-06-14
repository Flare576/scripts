#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js -- "$0" "$@"
  const usage = `Put a useful comment here`;
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option( 'duplicate', { alias: 'd', type: 'boolean', description: 'check for likely duplicates' })
  .option( 'refresh', { alias: 'r', type: 'boolean', description: 'Force folder read' })
.argv;
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');
const fs = require('fs');
const exif = require('exif').ExifImage;

const logSameLine = (line) => {
  const trimLine = line.substring(0, 80);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(trimLine);
}

const extensionsToIgnore = ['.db', '.ini'];
const filesWithFolders = (folder, list, subFolder = '') => {
  const files = fs.readdirSync(folder)
  files.forEach((fileName) => {
    const fullPath = `${folder}/${fileName}`;
    logSameLine(fullPath);
    if (fs.statSync(fullPath).isDirectory()){
      filesWithFolders(fullPath, list, fileName.replace(/[^a-zA-Z0-9]/g, ''));
    } else {
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      if (!extensionsToIgnore.includes(ext.toLowerCase())){
        list.push({ fileName, ext, folder, fullPath, subFolder });
      }
    }
  });
  return list;
}

// if checking for dups, keep a list of the files in destination folder and their dateTaken to compare
let knownFolders = {};
let existingDates = {};
let destDups = [];
const moveImage = async (oldFile, newFolder) => {
  const { ext, fullPath } = oldFile;
  let num = 0;
  if (!fs.existsSync(newFolder)) {
    fs.mkdirSync(newFolder, {recursive: true});
  } else {
    if (knownFolders[newFolder]) {
      num = knownFolders[newFolder];
    } else {
      logSameLine(`indexing ${newFolder}`);
      const files = fs.readdirSync(newFolder);
      for (file of files) {
        const fullPath = `${newFolder}/${file}`
        if (!fs.statSync(fullPath).isDirectory()){
          if (argv.duplicate) {
            const data = await extract(fullPath);
            existingDates[data.exif.CreateDate] = file
          }
          num = Math.max(num, file.substr(0,6));
        }
      };
      knownFolders[newFolder] = num;
    }
  }
  if (argv.duplicate && existingDates[oldFile.CreateDate]) {
    // Chances are *VERY* high that this is a duplicate image
    const duplicateFolder = `${newFolder}/duplicates`;
    if (!fs.existsSync(duplicateFolder)) {
      fs.mkdirSync(duplicateFolder);
    }
    let newBaseName = oldFile.fileName.split('.')[0] + '_dup';
    let idx = 1;
    let newFullPath;
    do {
      newFullPath = `${duplicateFolder}/${newBaseName}${idx}${oldFile.ext}`;
      idx++;
    }
    while (fs.existsSync(newFullPath));

    destDups.push(newFullPath);
    fs.copyFileSync(fullPath, newFullPath);
  } else {
    num++;
    knownFolders[newFolder] = num;
    while(`${num}`.length < 6) num = `0${num}`;
    const newName = `${num}${ext}`;

    fs.copyFileSync(fullPath, `${newFolder}/${newName}`);
  }
};

const extract = async (image) => {
  return new Promise((resolve, reject) => {
    new exif({ image }, (error, exifData) => {
      if (error) reject(error)
      else resolve(exifData)
    })
  })
};

const getFileList = (baseFolder) => {
  const log = `${baseFolder}/list.log`;
  if (fs.existsSync(log) && !argv.refresh) {
    logSameLine(`Parsing ${log} for ${baseFolder}`);
    return JSON.parse(fs.readFileSync(log));
  } else {
    const files = filesWithFolders(baseFolder, []);
    fs.writeFileSync(log, JSON.stringify(files), 'utf-8');
    return files;
  }
}

(async () => {
  const junkFolder = '/mnt/f/Pictures_test';
  const goodFolder = '/mnt/f/Pictures';
  const destination = '/mnt/f/FlareClean';

  let junkFiles = getFileList(junkFolder);
  let goodFiles = getFileList(goodFolder);

  let duplicates = [];
  let missing = [];

  junkFiles.forEach((junk) => {
    logSameLine(`Looking for ${junk.fileName}`);
    const goodCopy = goodFiles.find((good) => {
      if (good.fileName === junk.fileName) {
        return good.subFolder === junk.subFolder;
      }
    });
    if (goodCopy) {
        duplicates.push(junk);
    } else {
      missing.push(junk);
    }
  });
  fs.writeFileSync(`${destination}/duplicates.log`, duplicates.map(m=>m.fullPath).join('\n'), 'utf-8');
  fs.writeFileSync(`${destination}/missing.log`, missing.map(m=>m.fullPath).join('\n'), 'utf-8');

  let failed = [];
  console.log('');
  console.log('copying');
  console.log('');
  for (miss of missing) {
    const { fullPath } = miss;
    logSameLine(fullPath);
    try {
      const data = await extract(fullPath);
      miss.CreateDate = data.exif.CreateDate;
      const dateTaken = data.exif.CreateDate.substring(0,10).replace(/:/g, '-');
      const year = dateTaken.substring(0,4);
      const newFolder = `/mnt/f/Pictures_test_originals/${year}/${dateTaken}`;
      await moveImage(miss, newFolder);
    } catch (error) {
      failed.push(miss);
      console.log('');
      console.log(`Failed to EXIF ${miss.fullPath}: ${error}`);
      console.log('');
    }
  };
  fs.writeFileSync(`${destination}/failed.log`, failed.map(m=>m.fullPath).join('\n'), 'utf-8');
  fs.writeFileSync(`${destination}/destDups.log`, destDups.map(m=>m.fullPath).join('\n'), 'utf-8');
})();

// vim: ft=javascript

