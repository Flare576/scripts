#!/bin/sh
':' /*; 
# Put any node dependencies here
dependencies=(
  inquirer
  yargs
)
# Don't edit past here
current=$(npm -g list 2> /dev/null | grep '^├')
for dep in ${dependencies[@]}; do
  if ! [[ $current =~ "$dep@" ]]; then
    echo "Installing $dep"
    npm i -g $dep 
  fi
done
':' */
':' //;NODE_PATH=$(npm -g root) exec "$(command -v nodejs || command -v node)" "$0" "$@"
console.log("actual script starting");
const {execSync, exec} = require('child_process');
const argv = require('yargs').argv;
const inquirer = require('inquirer');

let namespace;
let context = argv.context;

if (!context) {
    console.log('Must provide context; trust, but verify.');
    return 1;
}

if (argv._.length === 1) {
    namespace = argv._[0];
    clearPods(context, namespace);
} else {
    const allNS = execSync(`kubectl get namespaces --context ${context}`, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .slice(1) // Remove header row
    .map(ns => ns.split(/\s+/)[0]);

    console.log(allNS);
    inquirer.prompt([{ type: 'list', name: 'namespace', message: 'Which namespace to clear?', choices: allNS }])
    .then(answers => {
        namespace = answers.namespace;
        clearPods(context, namespace);
    });
}

function clearPods (context, namespace) {
    const result = execSync(`kubectl get pods -n ${namespace} --context ${context}`, { encoding: 'utf8' });
    const output = [];
    result
        .trim()
        .split('\n')
        .slice(1)
        .map(ns => ns.split(/\s+/)[0])
        .forEach((podName) => {
            exec(`kubectl delete pods -n ${namespace} --context ${context} ${podName}`, (err, data) => {
                if (err)
                    console.log(err);
                else console.log(data);
            })
        })
}
