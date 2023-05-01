const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

ipcMain.on('upload-script', async (event) => {
    const options = {
        filters: [{ name: 'JavaScript', extensions: ['js'] }],
    };

    const { filePaths } = await dialog.showOpenDialog(mainWindow, options);

    if (filePaths.length > 0) {
        const scriptPath = filePaths[0];
        let counter = 1;

        while (fs.existsSync(`script_${counter}.js`)) {
            counter++;
        }

        fs.copyFileSync(scriptPath, `script_${counter}.js`);
        mainWindow.webContents.send('script-uploaded', `script_${counter}.js`);
    }
});

ipcMain.on('execute-script', async (event, scriptPath) => {
    try {
        await exec('npm install puppeteer');
        const { stdout, stderr } = await exec(`node ${scriptPath}`);

        if (stdout) {
            console.log(stdout);
            mainWindow.webContents.send('script-executed', stdout);
        }
        if (stderr) {
            console.error(stderr);
            mainWindow.webContents.send('script-error', stderr);
        }
    } catch (error) {
        console.error(error);
        mainWindow.webContents.send('script-error', error);
    }
});
