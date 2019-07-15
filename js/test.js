#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js "$0" "$@"
const argv = require('yargs').argv;
const inquirer = require('inquirer');

(async () => {
    const answers = await inquirer.prompt([{ type:'list', choices: ['yes', 'no'],  message: 'Can you see this?', name: 'dontcare' }]);
    const {_: raw, '$0': cmd, ...rest} = argv;
    console.log(`You passed in ${JSON.stringify(rest, null, 2)}`);
    if (argv._) {
        console.log(` and "${argv._}"`);
    }

    if (argv.scriptKiddo) {
        console.log('if you see "--scriptKiddo," some dependencies were missing and a sub-process was used to install it!');
    }
})();
