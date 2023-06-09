const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
``


let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });
    mainWindow.setMenuBarVisibility(false);

    mainWindow.loadFile('index.html');
    logToFile('--------------------Application Started-------------------');
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

ipcMain.on('populate-dropdowns', () => {
    mainWindow.webContents.send('scripts-dropdown-data', getFiles('script'));
    mainWindow.webContents.send('credentials-dropdown-data', getFiles('credentials'));
});

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

ipcMain.on('execute-script', (event, scriptPath, url, headless) => {
    logToFile('--------------------Script Execution Started-------------------');
    console.log('Executing script:', scriptPath);
    logToFile(`Executing script: ${scriptPath}`);

    exec('npm ls puppeteer', (error, stdout) => {
        if (error || !stdout.includes('puppeteer')) {
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
                execScript(scriptPath, url, headless);
            });
        } else {
            execScript(scriptPath, url, headless);
        }
    });
});


function execScript(scriptPath, url, headless) {
    headless = !headless;
    const scriptCommand = `node ${scriptPath} ${url} ${headless}`;
    console.log('Executing command:', scriptCommand);
    logToFile(`Executing command: ${scriptCommand}`);

    exec(scriptCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing script:', error);
            logToFile(`Error executing script: ${error}`);
            mainWindow.webContents.send('script-error', `Error executing script: ${error}`);
            return;
        }
        console.log('Script executed successfully:', stdout);
        logToFile(`Script executed successfully: ${stdout}`);
        mainWindow.webContents.send('script-executed', stdout);
    });
}

function uploadFile(fileType, options) {
    dialog.showOpenDialog(mainWindow, options).then(({ filePaths }) => {
        if (filePaths.length > 0) {
            const filePath = filePaths[0];
            const fileName = path.basename(filePath);
            const fileExtension = path.extname(fileName);
            const fileNameWithoutExtension = path.basename(fileName, fileExtension);
            let counter = 1;
            let newFileName = fileName;

            while (fs.existsSync(newFileName)) {
                newFileName = `${fileNameWithoutExtension}_${counter}${fileExtension}`;
                counter++;
            }

            if (options.filters[0].name === 'JSON') {
                // Read the contents of the JSON file
                fs.readFile(filePath, 'utf8', (err, contents) => {
                    if (err) {
                        console.error('Error reading JSON file:', err);
                        return;
                    }

                    try {
                        const jsonData = JSON.parse(contents);

                        // Validate the JSON data
                        if (!Array.isArray(jsonData)) {
                            throw new Error('JSON data must be an array.');
                        }

                        jsonData.forEach((item) => {
                            if (
                                !item.hasOwnProperty('login') ||
                                !item.hasOwnProperty('password')
                            ) {
                                throw new Error(
                                    'Each JSON object must have "login" and "password" properties.'
                                );
                            }
                        });

                        // JSON is valid, copy the file
                        fs.copyFileSync(filePath, newFileName);
                        console.log(`File uploaded: ${filePath} -> ${newFileName}`);
                        mainWindow.webContents.send('file-uploaded', fileType, newFileName);
                        logToFile(`File uploaded: ${filePath} -> ${newFileName}`);
                    } catch (error) {
                        console.error('Invalid JSON format:', error);
                        mainWindow.webContents.send(
                            'upload-error',
                            'Invalid JSON format: ' + error.message
                        );
                    }
                });
            } else {
                // No validation needed for non-JSON files, just copy the file
                fs.copyFileSync(filePath, newFileName);
                console.log(`File uploaded: ${filePath} -> ${newFileName}`);
                mainWindow.webContents.send('file-uploaded', fileType, newFileName);
                logToFile(`File uploaded: ${filePath} -> ${newFileName}`);
            }
        }
    }).catch((err) => {
        console.error(`Error uploading file: ${err}`);
        logToFile(`Error uploading file: ${err}`);
    });
}


function getFiles(fileType) {
    const extension = fileType === 'script' ? '.js' : '.json';
    const files = fs.readdirSync('.')
        .filter(file => file.endsWith(extension))
        .map(file => {
            const stats = fs.statSync(file);
            return {
                name: file,
                lastModified: stats.mtime.getTime()
            };
        })
        .sort((a, b) => b.lastModified - a.lastModified).map(file => file.name);
    return files;
}

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

