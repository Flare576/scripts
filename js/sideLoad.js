const Module = require('module');
const originalRequire = Module.prototype.require;
const {execSync, spawn} = originalRequire('child_process');

Module.prototype.require = function (path) {
    try {
        return originalRequire.apply(this, arguments);
    } catch (e) {
        execSync(`npm -g install ${path}`, { encoding: 'utf8' });
        process.on("exit", function () {
            process.argv.shift();
            spawn(process.argv.shift(), process.argv, {
                cwd: process.cwd(),
                detached : true,
                stdio: "inherit"
            });
        });
        process.exit();
    }
}
