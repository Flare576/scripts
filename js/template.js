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

(async () => {
  // Do what you do
})();

// vim: ft=javascript

