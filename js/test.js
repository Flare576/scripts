#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r ./sideLoad.js "$0" "$@"
const argv = require('yargs').argv;
const inquirer = require('inquirer');
console.log('main processing unit', argv);
const answers = inquirer.prompt([{ type:'input', message: 'Iz gud?', name: 'dontcare' }]);

