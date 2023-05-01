const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function uploadFile(fileType, options) {
    dialog.showOpenDialog(mainWindow, options).then(({ filePaths }) => {
        if (filePaths.length > 0) {
            const filePath = filePaths[0];
            let counter = 1;
            const fileExtension = fileType === 'script' ? 'js' : 'json';

            while (fs.existsSync(`${fileType}_${counter}.${fileExtension}`)) {
                counter++;
            }

            fs.copyFileSync(filePath, `${fileType}_${counter}.${fileExtension}`);
            mainWindow.webContents.send('file-uploaded', fileType, `${fileType}_${counter}.${fileExtension}`);
        }
    });
}

ipcMain.on('upload-file', (event, fileType) => {
    const options = {
        filters: [{ name: 'JSON', extensions: ['json'] }],
    };

    if (fileType === 'script') {
        options.filters = [{ name: 'JavaScript', extensions: ['js'] }];
    }

    uploadFile(fileType, options);
});

ipcMain.on('execute-script', (event, scriptPath) => {
    console.log('Executing script:', scriptPath);
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing script:', error);
            mainWindow.webContents.send('script-error', stderr);
            return;
        }

        console.log('Script executed successfully:', stdout);
        mainWindow.webContents.send('script-executed', stdout);
    });
});
