"use strict";

const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require("fs");
const path = require("path");
let logLevel = "debug";

const environment = process.env.ENVIRONMENT;
if (environment && environment.toLowerCase() == "production") {
    logLevel = "error";
}

const logDir = process.env.WIN_PATH;
const logFileName = process.env.WIN_FILENAME;

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const dailyRotateFileTransport = new transports.DailyRotateFile({
    colorize: "true",
    filename: `${logDir}/` + logFileName + `-%DATE%.log`,
    maxsize: 2000000,
    maxFiles: "10d",
    humanReadableUnhandledException: true,
    format: format.combine(
            format.printf((info) => {
                if(info.stack) {
                    return `${info.timestamp} [Level: ${info.level}] [File: ${info.label}]: ${info.stack}`
                }
                else {
                    return `${info.timestamp} [Level: ${info.level}] [File: ${info.label}]: ${info.message}`
                }
            })
        ),
});

const logger = (caller) => {
    return createLogger({
        level: logLevel,
        format: format.combine(
            format.label({ label: path.basename(caller) }), 
            format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
            format.errors({stack: true})),
        transports: [
            new transports.Console({
                level: logLevel,
                format: format.combine(
                    format.colorize(),
                    format.printf((info) => {
                        if(info.stack) {
                            return `${info.timestamp} [Level: ${info.level}] [File: ${info.label}]: ${info.stack}`
                        }
                        else {
                            return `${info.timestamp} [Level: ${info.level}] [File: ${info.label}]: ${info.message}`
                        }
                    })
                ),
            }),
            dailyRotateFileTransport,
        ],
    });
};

module.exports = logger;