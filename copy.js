import fs from 'fs-extra';
import {createRequire} from 'module';
import helpers from "espo-extension-tools/helpers.js";
import cp from "child_process";
import {Transpiler} from 'espo-frontend-build-tools';

const require = createRequire(import.meta.url);
const cwd = process.cwd();
const config = helpers.loadConfig();
const extensionParams = require('./extension.json');

if (helpers.hasProcessParam('all')) {
    copy().then(() => {
        setOwner().then(() => console.log('Done'));
    });
}
if (helpers.hasProcessParam('single')) {
    let file = helpers.getProcessParam('file');

    if (file) {
        file = file.replaceAll('\\', '/');
        let arr = file.split('src/files/');

        if (arr.length > 1) {
            copyFile(arr[1]).then(() => {
                console.log('Done');
            });
        }
    }
}

async function copy () {
    await transpile();

    runScripts();

    const moduleName = extensionParams.module;
    const mod = helpers.camelCaseToHyphen(moduleName);

    if (fs.existsSync(cwd + '/../custom/Espo/Modules/' + moduleName)) {
        console.log('  Removing backend files...');

        helpers.deleteDirRecursively(cwd + '/../custom/Espo/Modules/' + moduleName);
    }

    if (fs.existsSync(cwd + '/../client/custom/modules/' + mod)) {
        console.log('  Removing frontend files...');

        helpers.deleteDirRecursively(cwd + '/../client/custom/modules/' + mod);
    }

    if (
        extensionParams.bundled &&
        fs.existsSync(cwd + `/build/assets/transpiled/custom/modules/${mod}/src`)
    ) {
        fs.copySync(
            cwd + `/build/assets/transpiled/custom/modules/${mod}/src`,
            cwd + `/../client/custom/modules/${mod}/lib/transpiled/src`
        );
    }

    if (fs.existsSync(cwd + `/build/assets/lib`)) {
        fs.copySync(
            cwd + `/build/assets/lib`,
            cwd + `/../client/custom/modules/${mod}/lib/`
        );
    }

    if (fs.existsSync(cwd + '/../tests/unit/Espo/Modules/' + moduleName)) {
        console.log('  Removing unit test files...');

        helpers.deleteDirRecursively(cwd + '/../tests/unit/Espo/Modules/' + moduleName);
    }

    if (fs.existsSync(cwd + '/../tests/integration/Espo/Modules/' + moduleName)) {
        console.log('  Removing integration test files...');

        helpers.deleteDirRecursively(cwd + '/../tests/integration/Espo/Modules/' + moduleName);
    }

    console.log('  Copying files...');

    fs.copySync(cwd + '/src/files', cwd + '/../');

    if (fs.existsSync(cwd + '/tests')) {
        fs.copySync(cwd + '/tests', cwd + '/../tests');
    }
}

function copyFile(file) {
    return transpile(file).then(() => {
        const moduleName = extensionParams.module;
        const mod = helpers.camelCaseToHyphen(moduleName);

        const clientSrcPath = `client/custom/modules/${mod}/src/`;

        if (
            file.startsWith(clientSrcPath) &&
            file.endsWith('.js') &&
            extensionParams.bundled &&
            fs.existsSync(`${cwd}/build/assets/transpiled/${file.substring(7)}`)
        ) {
            fs.copySync(
                `${cwd}/build/assets/transpiled/${file.substring(7)}`,
                `${cwd}/../client/custom/modules/${mod}/lib/transpiled/src/${file.substring(clientSrcPath.length)}`
            );

            console.log('  Copying transpiled...');
        }

        console.log('  Copying source...');

        fs.copySync(`${cwd}/src/files/${file}`, `${cwd}/../${file}`);
    });
}

function transpile(file) {
    if (!extensionParams.bundled) {
        return Promise.resolve();
    }

    const mod = helpers.camelCaseToHyphen(extensionParams.module);

    if (file && !file.startsWith(`client/custom/modules/${mod}/src/`)) {
        return Promise.resolve();
    }

    if (!file) {
        helpers.deleteDirRecursively(`${cwd}/build/assets/transpiled/custom`);
    }

    console.log('  Transpiling...');

    const options = {
        path: `src/files/client/custom/modules/${mod}`,
        mod: mod,
        destDir: `build/assets/transpiled/custom`,
    };

    if (file) {
        options.file = `src/files/${file}`;
    }

    (new Transpiler(options)).process();

    return Promise.resolve();
}

function runScripts() {
    const scripts = /** @type {string[]} */extensionParams.scripts || [];

    if (scripts.length) {
        console.log('  Running scripts...');
    }

    scripts.forEach(script => {
        cp.execSync(script, {cwd: cwd, stdio: ['ignore', 'ignore', 'pipe']});
    });
}

function setOwner() {
    return new Promise(resolve => {
        try {
            cp.execSync(
                "chown -R " + config.install.defaultOwner + ":" + config.install.defaultGroup + " .",
                {
                    cwd: cwd + '..',
                    stdio: ['ignore', 'ignore', 'pipe'],
                }
            );
        }
        catch (e) {}

        resolve();
    });
}
