#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js -- "$0" "$@"
  const usage = `takes a file, finds the 'export const' lines, and makes them into duplicate files`;
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option( 'file', { alias: 'f', type: 'string', description: 'The file to split/dupe' })
  .option( 'folder', { alias: 'o', type: 'string', description: 'The folder to output to' })
.argv;
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');
const fs = require('fs').promises;

(async () => {
  // Do what you do
  const { folder, file: origFile } = argv;
  const orig = await fs.readFile(origFile, 'utf-8');
  let newContent = orig;

  const exportedFns = orig
    .split('\n')
    .filter(line => line.includes('export const'))
    .map(line => line.match(/export const ([^ ]+)/)[1]);

  for( fun of exportedFns) {
    const mahReg = new RegExp(`export const ${fun}.*`);
    newContent = newContent.replace(mahReg, `export { ${fun} } from './${fun}';`),
      await fs.copyFile(origFile, `${folder}/${fun}.ts`);
    /*
      orig.replace(mahReg, `export { ${fun} } from './${fun}'`),
      'utf-8',
    );
     */
  }
  await fs.writeFile(origFile, newContent, 'utf-8');
})();

// vim: ft=javascript

