#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js -- "$0" "$@"
const usage = `Put a useful comment here`;
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option( 'quiet', { alias: 'q', type: 'boolean', description: 'print a litle less' })
  .option( 'guess', { alias: 'g', type: 'boolean', description: 'Use other data to find date if exif not found' })
  .option( 'intake', { alias: 'i', type: 'string', demandOption: true,  description: 'intake folder' })
  .option( 'output', { alias: 'o', type: 'string', demandOption: true, description: 'destination folder' })
  .option( 'refresh', { alias: 'r', type: 'boolean', description: 'Force folder read' })
  .option( 'prefilter', { alias: 'p', type: 'boolean', description: 'process against Pictures' })
  .option( 'small', { alias: 's', type: 'boolean', description: 'separate files < 1MB to /small' })
  .option( 'dry_run', { alias: 'd', type: 'boolean', description: 'Log what script WOULD do - don\'t process' })
.argv;
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');
const fs = require('fs');
const exif = require('exif').ExifImage;

const extensionsToIgnore = ['.db', '.ini', '.info', '.log'];
let changeLog = [];
let knownFolders = {};
let existingDates = {};
let duplicates = [];

const appendLogFile = (file, content) => {
  fs.appendFileSync(file, `\n** New Log ${Date.now()}\n`, 'utf-8');
  fs.appendFileSync(file, content, 'utf-8');
}
const logSameLine = (line) => {
  const trimLine = line.substring(0, 120);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(trimLine);
}

const staticLog = (line) => {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  console.log(line);
}

const filesWithFolders = (folder, list, subFolder = '') => {
  const files = fs.readdirSync(folder)
  files.forEach((fileName) => {
    const fullPath = `${folder}/${fileName}`;
    logSameLine(fullPath);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()){
      filesWithFolders(fullPath, list, fileName.replace(/[^a-zA-Z0-9]/g, ''));
    } else {
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      if (!extensionsToIgnore.includes(ext.toLowerCase())){
        list.push({ fileName, ext, folder, fullPath, subFolder, size: stats.size });
      }
    }
  });
  return list;
}

const moveImage = async (oldFile, newFolder) => {
  const { fullPath, dateTaken, CreateDate } = oldFile;
  let ext = oldFile.ext;
  if (argv.small && oldFile.size < 1000000) {
    ext = `s${ext}`
    newFolder = newFolder.replace(argv.output, `${argv.output}/small`);
  }
  let num = 0;
  if (!fs.existsSync(newFolder)) {
    if (!argv.dry_run) fs.mkdirSync(newFolder, { recursive: true });
  } else {
    if (knownFolders[newFolder]) {
      num = knownFolders[newFolder];
    } else {
      const files = fs.readdirSync(newFolder);
      for (fileName of files) {
        const fullPath = `${newFolder}/${fileName}`
        const stats = fs.statSync(fullPath);
        if (!stats.isDirectory()){
          logSameLine(`indexing ${fullPath}`);
          const data = await extract(fullPath);
          if (!existingDates[data.CreateDate]) {
            existingDates[data.CreateDate] = [];
          }
          existingDates[data.CreateDate].push({ fileName, exif: data, size: stats.size });
          num = Math.max(num, fileName.substr(11,5));
        } else {
          staticLog(`WARNING: Folder not expected: ${fullPath}`);
        }
      };
      knownFolders[newFolder] = num;
    }
  }

  const original = existingDates[CreateDate]?.find(exist => filesEqual(oldFile, exist));
  if (original) {
    const duplicateFolder = newFolder.replace(argv.output, `${argv.output}/duplicates`);
    if (!fs.existsSync(duplicateFolder)) {
      if (!argv.dry_run) fs.mkdirSync(duplicateFolder, { recursive: true });
    }
    let newBaseName = original.fileName.split('.')[0] + '_dup';
    let idx = 1;
    let newFullPath;
    do {
      newFullPath = `${duplicateFolder}/${newBaseName}${idx}${oldFile.ext}`;
      idx++;
    }
    while (fs.existsSync(newFullPath));

    duplicates.push(`${oldFile.fullPath} -> ${newFullPath}`);
    changeLog.push(`COPY ${fullPath} -> ${newFullPath}`);
    if (!argv.dry_run) {
      fs.copyFileSync(fullPath, newFullPath);
    }
  } else {
    num++;
    knownFolders[newFolder] = num;
    while(`${num}`.length < 5) num = `0${num}`;
    const newName = `${dateTaken}_${num}${ext}`;
    if (!existingDates[CreateDate]) {
      existingDates[CreateDate] = [];
    }
    existingDates[CreateDate].push({ fileName: newName, exif: oldFile.exif });
    changeLog.push(`COPY ${fullPath} -> ${newFolder}/${newName}`);
    if (!argv.dry_run) {
      fs.copyFileSync(fullPath, `${newFolder}/${newName}`);
    }
  }
};

const filesEqual = (img1, img2) => {
  return img1.size === img2.size
    && img1.exif.Model === img2.exif.Model
    && img1.exif.CreateDate === img2.exif.CreateDate;
}

const extract = async (image) => {
  return new Promise((resolve, reject) => {
    new exif({ image }, (error, exifData) => {
      if (error) reject(error)
      else {
        const { image: { Model }, exif: { CreateDate } } = exifData;
        resolve({ Model, CreateDate });
      }
    })
  })
};

const getFileList = (baseFolder) => {
  const log = `${baseFolder}/list.log`;
  if (fs.existsSync(log) && !argv.refresh) {
    logSameLine(`Parsing ${log} for ${baseFolder}`);
    return JSON.parse(fs.readFileSync(log));
  } else {
    if (!argv.quiet) staticLog(`Scanning ${baseFolder}`);
    const files = filesWithFolders(baseFolder, []);
    fs.writeFileSync(log, JSON.stringify(files), 'utf-8');
    return files;
  }
}

const getFileDate = (fullPath) => {
  const pad = (val) => {
    while(`${val}`.length < 2) val = `0${val}`;
    return val;
  }
  const s = fs.statSync(fullPath);
  const d = [s.atime, s.mtime, s.ctime].sort((a,b) => a < b ? -1 : a === b ? 0 : 1)[0];
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${year}:${month}:${day} ${hour}:${min}:${sec}`;
}

(async () => {
  const intake = argv.intake.replace(/\/$/,'');

  let intakeFiles = [];
  if (argv.prefilter) {
    intakeFiles = getFileList(intake);
    staticLog('Comparing candidates list against primary pictures folder');
    const knownFiles = getFileList('/mnt/f/Pictures');
    let missing = [];

    intakeFiles.forEach((dupCheck) => {
      logSameLine(`Pre-Move Duplicate Checking for ${dupCheck.fileName}`);
      const knownCopy = knownFiles.find((good) => {
        if (good.fileName === dupCheck.fileName) {
          return good.subFolder === dupCheck.subFolder;
        }
      });
      if (!knownCopy) {
        missing.push(dupCheck);
      }
    });
    appendLogFile(`${argv.output}/missing.log`, missing.map(m=>m.fullPath).join('\n'));
    staticLog('Replacing candidates list with only "missing" items');
    intakeFiles = missing;
  } else {
    const { candidates } = await inquirer.prompt([{
      name: 'candidates',
      type: 'checkbox',
      choices: fs.readdirSync(intake).filter(file => fs.statSync(`${intake}/${file}`).isDirectory()),
      message: "Which subfolder(s)?",
    }]);
    candidates.forEach(nom => intakeFiles = intakeFiles.concat(getFileList(`${intake}/${nom}`)));
  }

  let failed = [];
  let guessed = [];
  staticLog(`copying ${intakeFiles.length}`);
  let count = 0;
  let size = intakeFiles.length;
  for (image of intakeFiles) {
    const { fullPath } = image;
    logSameLine(`${count++}/${size}: ${fullPath}`);
    let createDate;
    try {
      const data = await extract(fullPath);
      if (!data.CreateDate) {
        throw new Error('No CreateDate found in exif');
      }
      if (data.CreateDate === '0000:00:00 00:00:00') {
        throw new Error('Invalid CreateDate found in exif (\'0000:00:00 00:00:00\')');
      }
      image.exif = data;
      createDate = data.CreateDate
    } catch (error) {
      if (argv.guess) {
        createDate = getFileDate(fullPath);
        image.guess = createDate;
        guessed.push(image);
      } else {
        image.error = error;
        failed.push(image);
        staticLog(`Failed to EXIF ${image.fullPath}: ${error}`);
      }
    }
    if (createDate) {
      image.CreateDate = createDate;
      const dateTaken = createDate.substring(0,10).replace(/:/g, '-');
      const year = dateTaken.substring(0,4);
      image.dateTaken = dateTaken;
      const newFolder = `${argv.output}/${year}/${dateTaken}`;
      await moveImage(image, newFolder);
    }
  };
  appendLogFile(`${argv.output}/failed.log`, failed.map(m=> `${m.fullPath}: ${m.error}`).join('\n'));
  appendLogFile(`${argv.output}/duplicates.log`, duplicates.join('\n'));
  console.log('');
  console.log(`All ${count} files processed:`);
  console.log(`${count - failed.length} moved (${failed.length} Failed, see ${argv.output}/failed.log)`);
  console.log(`${duplicates.length} duplicates found, see ${argv.output}/duplicates.log)`);
  if (argv.guess) {
    console.log(`${guessed.length} guessed dates,see ${argv.output}/guessed.log)`);
    appendLogFile(`${argv.output}/guessed.log`, guessed.map(m=> `${m.fullPath}: ${m.guess}`).join('\n'));
  }
  if (argv.dry_run) {
    console.log(`Dry run: see actions ${argv.output}/dryrun.log`);
  }
  appendLogFile(`${argv.output}/changeLog.log`, changeLog.join('\n'), 'utf-8');
})();

// vim: ft=javascript
