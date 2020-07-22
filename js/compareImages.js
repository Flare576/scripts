#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js -- "$0" "$@"
  const usage = `Put a useful comment here`;
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option( 'argument', { alias: 'a', type: 'boolean', description: 'what arg is used for' })
.argv;
const inquirer = require('inquirer');
const {execSync, spawn} = require('child_process');
const compareImages = require('resemblejs/compareImages');
const fs = require('fs');

(async () => {
  // Do what you do
  const existing = fs.readFileSync('/mnt/f/Photography/2010/2010-10-19/2010-10-19_00007.jpg');
  const dupe = fs.readFileSync('/mnt/f/Data/backups/lis.pre-7-31-2011/media/internal/DCIM/100PALM/CIMG0018.jpg');

  const result = await compareImages(existing, dupe);

  console.log(result);
})();

// vim: ft=javascript

