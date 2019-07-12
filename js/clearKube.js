#!/bin/sh
':' //;NODE_PATH=$(npm -g root) exec node -r ./sideLoad.js "$0" "$@"
const {execSync, exec} = require('child_process');
const argv = require('yargs').argv;
const inquirer = require('inquirer');

(async () => {
    if (argv.h) {
        console.log('You must provide a --context. You may provide a --namespace, or let this script help you choose.');
        return 0;
    }

    let namespace;
    let context = argv.context;

    if (!context) {
        console.log('Must provide context; trust, but verify.');
        return 1;
    }

    if (argv._.length === 1) {
        namespace = argv._[0];
    } else {
        const allNS = cmdToList(`kubectl get namespaces --context ${context}`)
        const answers = await inquirer.prompt([{ type: 'list', name: 'namespace', message: 'Which namespace to clear?', choices: allNS }])
        namespace = answers.namespace;
    }
    clearPods(context, namespace);
})();

function clearPods (context, namespace) {
    cmdToList(`kubectl get pods -n ${namespace} --context ${context}`)
        .forEach((podName) => {
            exec(`kubectl delete pods -n ${namespace} --context ${context} ${podName}`, (err, data) => {
                if (err)
                    console.log(err);
                else console.log(data);
            })
        })
}

function cmdToList (cmd) {
    return execSync(cmd, { encoding: 'utf8' })
            .trim()
            .split('\n')
            .slice(1) // Remove header row
            .map(ns => ns.split(/\s+/)[0]);
}

