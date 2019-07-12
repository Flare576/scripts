#!/bin/sh
':' /*; # Put any node dependencies here (and see Readme)
d=(
  inquirer
  yargs
); c=$(npm -g list 2> /dev/null | grep '^├' | cut -d ' ' -f2)
for i in ${d[@]}; do if ! [[ $c =~ "$i@" ]]; then echo "Installing $i"; npm install -g $i; fi; done; ':' */
':' //;NODE_PATH=$(npm -g root) exec node "$0" "$@"
const {execSync, exec} = require('child_process');
const argv = require('yargs').argv;
const inquirer = require('inquirer');

// "Main" processing
(async () => {
    // argv.<variable> will have named arguments passed in
    // argv._ will be an array of unnamed arguments passed in
    if (argv.h) {
        console.log('give the user a little help');
        return 0;
    }
})();

