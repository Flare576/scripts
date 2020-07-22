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
  .option( 'photo_out', { alias: 'p', type: 'string', demandOption: true, description: 'destination folder for photos' })
  .option( 'video_out', { alias: 'v', type: 'string', demandOption: true, description: 'destination folder for videos' })
  .option( 'log_out', { alias: 'l', type: 'string', demandOption: true, description: 'destination folder for logs' })
  .option( 'filter_against', { alias: 'f', type: 'string', description: 'pre-process against provided folder' })
  .option( 'quiet', { alias: 'q', type: 'boolean', description: 'print a litle less' })
  .option( 'small', { alias: 's', type: 'number', default: .5, description: 'size for cutoff of "small" in MB (0.5 default)' })
  .option( 'text', { alias: 't', type: 'string', description: 'Text to match original photo on' })
.argv;
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');
const fs = require('fs');
// todo: wire this shit up
const compareImages = require('resemblejs/compareImages');
const vExif = require('exiftool-vendored').exiftool;
const {
  appendLogFile,
  logSameLine,
  staticLog,
  filesWithFolders,
} = require('./scriptUtils');

const ignoreExts = ['.htm', '.html', '.ind', '.zip', '.pdf', '.mp3', '.txt', '.epub', '.ipk', '.exe', '.php' ];
const alternateExts = ['.psd', '.gif'];
const deleteExts = ['.db', '.ini', '.info', '.htaccess', '.ds_store'];
const videoExts = ['.mp4', '.m4v', '.mpg', '.avi', '.3g2','.mov', '.3gp'];
const photoExts = ['.ctg', '.png', '.tif', '.crw', '.jpeg', '.jpg'];
let changeLog = [];
let knownFolders = {};
let existingDates = {};
let duplicates = [];
let ignored = [];
let failed = [];
let guessed = [];
let validExts = [];
if (argv.video_out) {
  validExts = validExts.concat(videoExts);
} else if(argv.photo_out) {
  validExts = validExts.concat(photoExts);
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

const moveImage = async (oldFile) => {
  const { fullPath, dateTaken, iDate, size } = oldFile;
  let ext = oldFile.ext;
  let outputRoot;
  if (argv.video_out && videoExts.includes(ext)) {
    outputRoot = argv.video_out.replace(/\/$/,'');
  } else if (argv.photo_out && photoExts.includes(ext)) {
    outputRoot = argv.photo_out.replace(/\/$/,'');
  } else {
    // how did you even get here
    return;
  }
  let smallPiece = '';
  if (size < argv.small * 1000000) {
    ext = `s${ext}`
    smallPiece = '/small';
  }

  let destFolder = `${outputRoot}${smallPiece}/${oldFile.dateTaken}`;
  let finalFileName;

  let num = 0;
  if (!fs.existsSync(destFolder)) {
    if (!argv.dry_run) fs.mkdirSync(destFolder, { recursive: true });
    else num = knownFolders[destFolder] || num; // dry-run doesn't create folders, so need to fake the find
  } else {
    if (knownFolders[destFolder]) {
      num = knownFolders[destFolder];
    } else {
      const files = fs.readdirSync(destFolder);
      for (fileName of files) {
        const fullPath = `${destFolder}/${fileName}`
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
      knownFolders[destFolder] = num;
    }
  }

  const original = existingDates[iDate]?.find(exist => filesEqual(oldFile, exist));
  if (original) {
    destFolder = `${outputRoot}/duplicates${smallPiece}/${oldFile.dateTaken}`
    if (!fs.existsSync(destFolder)) {
      if (!argv.dry_run) fs.mkdirSync(destFolder, { recursive: true });
    }
    let newBaseName = original.fileName.split('.')[0] + '_dup';
    let idx = 1;
    do {
      finalFileName = `${newBaseName}${idx}${ext}`;
      idx++;
    }
    while (fs.existsSync(`${destFolder}${finalFileName}`));

    duplicates.push(`${fullPath} -> ${destFolder}${finalFileName}`);
  } else {
    num++;
    knownFolders[newFolder] = num;
    while(`${num}`.length < 5) num = `0${num}`;
    finalFileName = `${dateTaken}_${num}${ext}`;
    if (!existingDates[iDate]) {
      existingDates[iDate] = [];
    }
    existingDates[iDate].push({ fileName: newName, extraData: oldFile.extraData, iDate, size });
  }
    changeLog.push(`COPY ${fullPath} -> ${destFolder}/${finalFileName}`);
    if (!argv.dry_run) {
      if (argv.move) {
        fs.renameSync(fullPath, `${destFolder}/${finalFileName}`);
      } else {
        fs.copyFileSync(fullPath, `${destFolder}/${finalFileName}`);
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
    const vData = await vExif.read(fullPath);
    iDate = vData?.DateTimeOriginal?.rawValue || vData?.CreateDate?.rawValue|| vData?.FileModifyDate?.rawValue;
    if (!iDate) {
      throw new Error(`No DateTimeOriginal found in media file: ${JSON.stringify(vData, null, 2)}`);
    }
    iDate = imageData.iDate;
    extraData = imageData.extraData;
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

const getFileList = async (baseFolder) => {
  if (!argv.quiet) staticLog(`Scanning ${baseFolder}`);
  const { good, ignored: i } = await filesWithFolders(baseFolder, {}, {
    validExts,
    ignoreExts,
    deleteExts:  deleteExts,
    ignoreText: argv.text,
  });

  ignored = i;
  return good;
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
  if (argv.filter_against) {
    candidates = [intake];
    intakeFiles = await getFileList(intake);
    staticLog('Comparing candidates list against primary pictures folder');
    const knownFiles = await getFileList(argv.filter_against);
    let missing = [];

    intakeFiles.forEach((dupCheck) => {
      logSameLine(`Pre-Move Duplicate Checking for ${dupCheck.fileName}`);
      const knownCopy = knownFiles.find((good) => good.fileName === dupCheck.fileName);
      if (!knownCopy) {
        missing.push(dupCheck);
      }
    });
    appendLogFile(`${argv.log_out}/missing.log`, missing.map(m=>m.fullPath).join('\n'));
    staticLog('Replacing candidates list with only "missing" items');
    intakeFiles = missing;
  } else {
    const responses = await inquirer.prompt([{
      name: 'candidates',
      type: 'checkbox',
      choices: fs.readdirSync(intake).filter(file => fs.statSync(`${intake}/${file}`).isDirectory()),
      message: "Which subfolder(s)?",
    }]);
    await Promise.all(responses.candidates.map(async (nom) => {
      const fullPath = `${intake}/${nom}`;
      candidates.push(fullPath);
      intakeFiles = intakeFiles.concat(await getFileList(fullPath));
    }));
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
      await moveImage(image, newFolder);
    }
  };
  if (argv.dry_run) {
    console.log(`Dry run: see actions ${argv.log_out}/dryrun.log`);
    fs.writeFileSync(`${argv.log_out}/dryrun.log`, changeLog.join('\n'), 'utf-8');
    fs.writeFileSync(`${argv.log_out}/dryrun_failed.log`, failed.map(m=> `${m.fullPath}: ${m.error}`).join('\n'));
    fs.writeFileSync(`${argv.log_out}/dryrun_duplicates.log`, duplicates.join('\n'));
    fs.writeFileSync(`${argv.log_out}/dryrun_ignored.log`, ignored.join('\n'));
    if (argv.guess) {
      fs.writeFileSync(`${argv.log_out}/dryrun_guessed.log`, guessed.map(m=> `${m.fullPath}: ${m.guess}`).join('\n'));
    }
  } else {
    if (argv.clean) {
      staticLog('Removing empty folders');
      candidates.forEach(candy => {
        deleteEmptyFolders(candy);
      });
    }
    appendLogFile(`${argv.log_out}/failed.log`, failed.map(m=> `${m.fullPath}: ${m.error}`).join('\n'));
    appendLogFile(`${argv.log_out}/duplicates.log`, duplicates.join('\n'));
    appendLogFile(`${argv.log_out}/ignored.log`, ignored.join('\n'));
    console.log('');
    console.log(`All ${count} files processed:`);
    console.log(`${count - failed.length} moved (${failed.length} Failed, see ${argv.log_out}/failed.log)`);
    console.log(`${duplicates.length} duplicates found, see ${argv.log_out}/duplicates.log)`);
    console.log(`${ignored.length} ignored files skipped, see ${argv.log_out}/ignored.log)`);
    if (argv.guess) {
      console.log(`${guessed.length} guessed dates,see ${argv.log_out}/guessed.log)`);
      appendLogFile(`${argv.log_out}/guessed.log`, guessed.map(m=> `${m.fullPath}: ${m.guess}`).join('\n'));
    }
    appendLogFile(`${argv.log_out}/changeLog.log`, changeLog.join('\n'), 'utf-8');
  }
  vExif.end();
})();

// vim: ft=javascript
