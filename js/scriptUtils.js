const fs = require('fs').promises;

exports.logRecord = [];

exports.appendLogFile = async (file, content) => {
  const finalData = `\n** New Log ${Date.now()}\n${content || this.logRecord.join('\n')}`;
  await fs.appendFile(file, finalData, 'utf-8');
}

exports.replaceLogFile = async (file, content) => {
  const finalData = `${Date.now()}\n${content || this.logRecord.join('\n')}`;
  await fs.writeFile(file, finalData, 'utf-8');
}


exports.logSameLine = (line, length = 120, track = true) => {
  if (track) {
    this.logRecord.push(line);
  }
  const trimLine = line.substring(0, length);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(trimLine);
}

exports.staticLog = (line, track = true) => {
  if(track) {
    this.logRecord.push(line);
  }
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  console.log(line);
}

/*
{
  ignored: {},
  deleted: {},
  files: {
    folder: string,
    fileName: string,
    fullPath: string,
    ext: string,
    size: number,
  }
*/
exports.filesWithFolders = async (folder, lists, filters) => {
  const {
    good = [],
    ignored = [],
    deleted = [],
  } = lists || {};
  const {
    validExts = [],
    ignoreExts = [],
    deleteExts = [],
    ignoreText = '',
  } = filters || {};
  const files = await fs.readdir(folder);
  for (fileName of files) {
    const fullPath = `${folder}/${fileName}`;
    this.logSameLine(fullPath,'',false);
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()){
      await this.filesWithFolders(fullPath, { good, ignored, deleted }, filters);
    } else {
      const finalDot = fileName.lastIndexOf('.');
      const baseFileName = fileName.substring(0,finalDot);
      const ext = fileName.substring(finalDot);
      if (deleteExts.includes(ext.toLowerCase())) {
        deleted.push(fullPath);
        fs.unlink(fullPath);
      } else if (
        ignoreExts.includes(ext.toLowerCase())
        || (ignoreText && !fullPath.toLowerCase().includes(ignoreText.toLowerCase()))
        || (validExts.length && !validExts.includes(ext.toLowerCase()))
      ){
        ignored.push(fullPath);
      } else {
        good.push({ fileName, ext, baseFileName, folder, fullPath, size: stats.size });
      }
    }
  }
  return { good, ignored, deleted };
}
