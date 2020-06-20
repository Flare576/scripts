#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js -- "$0" "$@"
const usage = `Put a useful comment here`;
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option( 'clean', { alias: 'c', type: 'boolean', description: 'delete empty folders on completion' })
  .option( 'dry_run', { alias: 'd', type: 'boolean', description: 'Log what script WOULD do - don\'t process' })
  .option( 'extensions', { alias: 'e', choices: ['video', 'image'], description: '' })
  .option( 'guess', { alias: 'g', type: 'boolean', description: 'Use other data to find date if exif not found' })
  .option( 'intake', { alias: 'i', type: 'string', demandOption: true,  description: 'intake folder' })
  .option( 'move', { alias: 'm', type: 'boolean', description: 'Move instead of copy' })
  .option( 'output', { alias: 'o', type: 'string', demandOption: true, description: 'destination folder' })
  .option( 'prefilter', { alias: 'p', type: 'string', description: 'pre-process against provided folder' })
  .option( 'quiet', { alias: 'q', type: 'boolean', description: 'print a litle less' })
  .option( 'small', { alias: 's', type: 'number', default: .5, description: 'size for cutoff of "small" in MB (0.5 default)' })
  .option( 'text', { alias: 't', type: 'string', description: 'Text to match original photo on' })
.argv;
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');
const fs = require('fs');
const iExif = require('exif').ExifImage;
const vExif = require('exiftool-vendored').exiftool;

const extensionsToIgnore = ['.htm', '.html', '.ind', '.zip', '.pdf', '.mp3', '.txt', '.epub', '.ipk', '.exe', '.php' ];
const alternateExts = ['.psd', '.gif'];
const videoExts = ['.mp4', '.m4v', '.mpg', '.avi', '.3g2','.mov', '.3gp'];
const imageExts = ['.ctg', '.png', '.tif', '.crw', '.jpeg', '.jpg'];
const extensionsToDelete = ['.db', '.ini', '.info', '.htaccess', '.ds_store'];
let changeLog = [];
let knownFolders = {};
let existingDates = {};
let duplicates = [];
let ignored = [];
let failed = [];
let guessed = [];
let validExts = ['.jpg', '.jpeg'];
if (argv.extensions === 'video') {
  validExts = videoExts;
} else if(argv.extensions === 'image') {
  validExts = imageExts;
}

const appendLogFile = (file, content) => {
  fs.appendFileSync(file, `\n** New Log ${Date.now()}\n${content}`, 'utf-8');
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
    if (files.length === 1 && files[0] === 'list.log') {
      fs.unlinkSync(`${folder}/list.log`);
      files.pop();
    }

    if (!files.length) {
      logSameLine(`Deleting ${folder}`);
      fs.rmdirSync(folder);
      return true;
    }
    return false;
  }
}

const filesWithFolders = (folder, list, subFolder = '') => {
  const files = fs.readdirSync(folder);
  files.forEach((fileName) => {
    const fullPath = `${folder}/${fileName}`;
    logSameLine(fullPath);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()){
      filesWithFolders(fullPath, list, fileName.replace(/[^a-zA-Z0-9]/g, ''));
    } else {
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      if (extensionsToDelete.includes(ext.toLowerCase())) {
        fs.unlinkSync(fullPath);
      } else if (
        extensionsToIgnore.includes(ext.toLowerCase())
        || (argv.text && !fullPath.toLowerCase().includes(argv.text.toLowerCase()))
        || (!validExts.includes(ext.toLowerCase()))
      ){
        ignored.push(fullPath);
      } else {
        list.push({ fileName, ext, folder, fullPath, subFolder, size: stats.size });
      }
    }
  });
  return list;
}

const moveImage = async (oldFile, newFolder) => {
  const { fullPath, dateTaken, iDate, size } = oldFile;
  let ext = oldFile.ext;
  if (size < argv.small * 1000000) {
    ext = `s${ext}`
    newFolder = newFolder.replace(argv.output, `${argv.output}/small`);
  }
  let num = 0;
  if (!fs.existsSync(newFolder)) {
    if (!argv.dry_run) fs.mkdirSync(newFolder, { recursive: true });
    else num = knownFolders[newFolder] || num; // dry-run doesn't create folders, so need to fake the find
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
          const data = await extract(fullPath, true);
          if (!existingDates[data.iDate]) {
            existingDates[data.iDate] = [];
          }
          existingDates[data.iDate].push({ fileName, ...data, size: stats.size });
          num = Math.max(num, fileName.substr(11,5));
        } else {
          staticLog(`WARNING: Folder not expected: ${fullPath}`);
        }
      };
      knownFolders[newFolder] = num;
    }
  }

  const original = existingDates[iDate]?.find(exist => filesEqual(oldFile, exist));
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
      if (argv.move) {
        fs.renameSync(fullPath, newFullPath);
      } else {
        fs.copyFileSync(fullPath, newFullPath);
      }
    }
  } else {
    num++;
    knownFolders[newFolder] = num;
    while(`${num}`.length < 5) num = `0${num}`;
    const newName = `${dateTaken}_${num}${ext}`;
    if (!existingDates[iDate]) {
      existingDates[iDate] = [];
    }
    existingDates[iDate].push({ fileName: newName, extraData: oldFile.extraData, iDate, size });
    changeLog.push(`COPY ${fullPath} -> ${newFolder}/${newName}`);
    if (!argv.dry_run) {
      if (argv.move) {
        fs.renameSync(fullPath, `${newFolder}/${newName}`);
      } else {
        fs.copyFileSync(fullPath, `${newFolder}/${newName}`);
      }
    }
  }
};

const filesEqual = (img1, img2) => {
  return img1.size === img2.size
    && img1.extraData?.Model === img2.extraData?.Model
    && img1.iDate === img2.iDate;
}

const extract = async (fullPath, guess = false) => {
  let iDate;
  let extraData = {};
  try {
    if (argv.extensions) {
      const vData = await vExif.read(fullPath);
      iDate = vData?.DateTimeOriginal?.rawValue || vData?.CreateDate?.rawValue|| vData?.FileModifyDate?.rawValue;
      if (!iDate) {
        throw new Error(`No DateTimeOriginal found in media file: ${JSON.stringify(vData, null, 2)}`);
      }
    } else {
      const imageData = await new Promise((resolve, reject) => {
        new iExif({ image: fullPath }, (error, exifData) => {
          const { image: { Model, ModifyDate } = {}, exif: { CreateDate } = {} } = exifData || {};
          const iDate = CreateDate || ModifyDate;
          const extraData = { Model };
          const errorMessage = error
            ? error.message
            : !iDate
            ? 'No CreateDate or ModifyDate found in exif'
            : iDate === '0000:00:00 00:00:00'
            ? 'Invalid CreateDate/ModifyDate found in exif (\'0000:00:00 00:00:00\')'
            : '';
          if (errorMessage) reject(new Error(errorMessage));
          else resolve({ iDate, extraData: { Model } });
        });
      });
      iDate = imageData.iDate;
      extraData = imageData.extraData;
    }
  } catch(error) {
    if (guess) {
      iDate = getFileDate(fullPath);
      guessed.push({ fullPath, guess: iDate });
    } else {
      staticLog(`Failed to EXIF ${fullPath}: ${error}`);
      failed.push({ fullPath, error });
      throw error;
    }
  }
  return { iDate, extraData };
}

const getFileList = (baseFolder) => {
  if (!argv.quiet) staticLog(`Scanning ${baseFolder}`);
  const files = filesWithFolders(baseFolder, []);
  return files;
}

// TODO: Should check filename for date and verify it matches
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
  let candidates = [];

  let intakeFiles = [];
  if (argv.prefilter) {
    candidates = [intake];
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
    const responses = await inquirer.prompt([{
      name: 'candidates',
      type: 'checkbox',
      choices: fs.readdirSync(intake).filter(file => fs.statSync(`${intake}/${file}`).isDirectory()),
      message: "Which subfolder(s)?",
    }]);
    responses.candidates.forEach(nom => {
      const fullPath = `${intake}/${nom}`;
      candidates.push(fullPath);
      intakeFiles = intakeFiles.concat(getFileList(fullPath));
    });
  }

  staticLog(`copying ${intakeFiles.length}`);
  let count = 0;
  let size = intakeFiles.length;
  for (image of intakeFiles) {
    const { fullPath, ext } = image;
    if (alternateExts.includes(ext.toLowerCase()) && !argv.alternate) {
      ignored.push(fullPath);
      continue;
    }
    logSameLine(`${++count}/${size}: ${fullPath}`);
    try {
      const data = await extract(fullPath, argv.guess);
      image = { ...image, ...data };
    } catch (error) {}
    if (image.iDate) {
      const dateTaken = image.iDate.substring(0,10).replace(/:/g, '-');
      const year = dateTaken.substring(0,4);
      image.dateTaken = dateTaken;
      const newFolder = `${argv.output}/${year}/${dateTaken}`;
      await moveImage(image, newFolder);
    }
  };
  if (argv.dry_run) {
    console.log(`Dry run: see actions ${argv.output}/dryrun.log`);
    fs.writeFileSync(`${argv.output}/dryrun.log`, changeLog.join('\n'), 'utf-8');
    fs.writeFileSync(`${argv.output}/dryrun_failed.log`, failed.map(m=> `${m.fullPath}: ${m.error}`).join('\n'));
    fs.writeFileSync(`${argv.output}/dryrun_duplicates.log`, duplicates.join('\n'));
    fs.writeFileSync(`${argv.output}/dryrun_ignored.log`, ignored.join('\n'));
    if (argv.guess) {
      fs.writeFileSync(`${argv.output}/dryrun_guessed.log`, guessed.map(m=> `${m.fullPath}: ${m.guess}`).join('\n'));
    }
  } else {
    if (argv.clean) {
      staticLog('Removing empty folders');
      candidates.forEach(candy => {
        deleteEmptyFolders(candy);
      });
    }
    appendLogFile(`${argv.output}/failed.log`, failed.map(m=> `${m.fullPath}: ${m.error}`).join('\n'));
    appendLogFile(`${argv.output}/duplicates.log`, duplicates.join('\n'));
    appendLogFile(`${argv.output}/ignored.log`, ignored.join('\n'));
    console.log('');
    console.log(`All ${count} files processed:`);
    console.log(`${count - failed.length} moved (${failed.length} Failed, see ${argv.output}/failed.log)`);
    console.log(`${duplicates.length} duplicates found, see ${argv.output}/duplicates.log)`);
    console.log(`${ignored.length} ignored files skipped, see ${argv.output}/ignored.log)`);
    if (argv.guess) {
      console.log(`${guessed.length} guessed dates,see ${argv.output}/guessed.log)`);
      appendLogFile(`${argv.output}/guessed.log`, guessed.map(m=> `${m.fullPath}: ${m.guess}`).join('\n'));
    }
    appendLogFile(`${argv.output}/changeLog.log`, changeLog.join('\n'), 'utf-8');
  }
  vExif.end();
})();

// vim: ft=javascript
