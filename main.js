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

            const newFilePath = `${fileType}_${counter}.${fileExtension}`;
            fs.copyFileSync(filePath, newFilePath);
            console.log(`File uploaded: ${filePath} -> ${newFilePath}`);
            mainWindow.webContents.send('file-uploaded', fileType, newFilePath);
            logToFile(`File uploaded: ${filePath} -> ${newFilePath}`);
        }
    }).catch((err) => {
        console.error(`Error uploading file: ${err}`);
        logToFile(`Error uploading file: ${err}`);
    });
}

ipcMain.on('upload-file', (event, fileType) => {
    let options = {
        filters: [{ name: 'JSON', extensions: ['json'] }],
    };

    if (fileType === 'script') {
        options = {
            filters: [{ name: 'JavaScript', extensions: ['js'] }],
        };
    }

    uploadFile(fileType, options);
});


function logToFile(message) {
    const logFilePath = path.join(app.getPath('userData'), 'app-sample-log.txt');
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} - ${message}\n`;

    fs.appendFile(logFilePath, formattedMessage, (err) => {
        if (err) {
            console.error(`Error writing log: ${err}`);
            console.log(`Error writing log: ${err}`);
        } else {
            console.log(`Log written: ${formattedMessage.trim()}`);
        }
    });
}

ipcMain.on('execute-script', (event, scriptPath) => {
    console.log('Executing script:', scriptPath);
    logToFile(`Executing script: ${scriptPath}`);

    // Check if Puppeteer is installed
    exec('npm ls puppeteer', (error, stdout) => {
        if (error || !stdout.includes('puppeteer')) {
            // Install Puppeteer
            console.log('Puppeteer not found. Installing...');
            logToFile('Puppeteer not found. Installing...');
            exec('npm install puppeteer', (error, stdout, stderr) => {
                if (error) {
                    console.error('Error installing Puppeteer:', error);
                    logToFile(`Error installing Puppeteer: ${error}`);
                    mainWindow.webContents.send('script-error', `Error installing Puppeteer: ${error}`);
                    return;
                }
                console.log('Puppeteer installed successfully:', stdout);
                logToFile(`Puppeteer installed successfully: ${stdout}`);
                // Execute the script after Puppeteer is installed
                execScript(scriptPath);
            });
        } else {
            // Execute the script if Puppeteer is already installed
            execScript(scriptPath);
        }
    });
});

function execScript(scriptPath) {
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing script:', error);
            logToFile(`Error executing script: ${error}`);
            mainWindow.webContents.send('script-error', stderr);
            return;
        }

        console.log('Script executed successfully:', stdout);
        logToFile(`Script executed successfully: ${stdout}`);
        mainWindow.webContents.send('script-executed', stdout);
    });
}




ipcMain.on('log-message', (event, message) => {
    console.log(`Log message: ${message}`);
    logToFile(`Log message: ${message}`);
});

