const Module = require('module');
const originalRequire = Module.prototype.require;
const {execSync, spawnSync} = originalRequire('child_process');

const scriptFlag = '--scriptKiddo';
const depFlag = 42;

Module.prototype.require = function (path) {
    try {
        return originalRequire.apply(this, arguments);
    } catch (e) {
        console.log(`Installing ${path}`);
        execSync(`npm -g install ${path}`, { encoding: 'utf8' });
        const len = process.argv.length;
        if (len > 2 && process.argv[len - 1] === scriptFlag) {
            process.exit(depFlag);
        }
        process.argv.shift();
        const executable = process.argv.shift();
        process.argv.push(scriptFlag);

        let result = null;
        while (result === null || result === depFlag) {
            result = spawnSync(executable, process.argv, {
                cwd: process.cwd(),
                detached : true,
                stdio: "inherit"
            });
            result = result.status;
        }
        process.exit();
    }
}
