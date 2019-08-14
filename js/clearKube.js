#!/bin/sh
":" //;NODE_PATH=$(npm -g root) exec node -r $(dirname $0)/sideLoad.js "$0" "$@"
const usage = `Runs 'kubectl delete' on every pod in a namespace in a context. If namespace isn't provided, a prompt \
will appear.`;
const contextError = 'Must provide context: trust, but verify.';
const argv = require('yargs')
  .usage(usage)
  .alias('help', 'h')
  .option('context', { alias: 'c', type: 'string', description: 'k8s context', demandOption: contextError,
    requiresArg: true, coerce: arg => {
      if(!arg) {
        throw new Error(contextError);
      }
      return arg;
    }
  })
.option('namespace', { alias: 'n', type: 'string', description: 'k8s namespace' })
.argv;
const {execSync, exec} = require('child_process');
const inquirer = require('inquirer');

(async () => {
    let { namespace, context } = argv;

    if (!namespace) {
        const allNS = cmdToList(`kubectl get namespaces --context ${context}`)
        const answers = await inquirer.prompt([{ type: 'list', name: 'namespace', message: 'Which namespace to clear?', choices: allNS }])
        namespace = answers.namespace;
    }
    clearPods(context, namespace);
})();

function clearPods (context, namespace) {
    cmdToList(`kubectl get pods -n ${namespace} --context ${context}`)
        .forEach((podName) => {
            const cmd = `kubectl delete pods -n ${namespace} --context ${context} ${podName}`;
            console.log(`Executing ${cmd}`);
            execSync(cmd, (err, data) => {
                console.log(`Complete: ${podName}\nResult: ${data}\nError: ${err}`);
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
// vim: ft=javascript
