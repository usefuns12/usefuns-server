const compression = require("compression");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require('helmet');
const routes = require('./routes/index.route');
require('dotenv').config();

let app = express();

app.use(compression());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: false, parameterLimit: 1000000 }));
app.use(cookieParser());

// secure apps by setting various HTTP headers
app.use(helmet());

// enable CORS - Cross Origin Resource Sharing
let cors = require("cors");
app.use(cors());

app.get("/", (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Usefuns</title>
        </head>
        <body style="text-align: center; padding-top: 100px;">
            <h1 style="color: #51067d;">Usefuns Official</h1>
            <p>Meet new friends and join live party.</p>
        </body>
        </html>
    `);
});

// mount all routes on /api path
app.use('/api/v1', routes);

// Catch 404 and handle it
app.use((req, res, next) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Usefuns</title>
        </head>
        <body style="text-align: center; padding-top: 100px;">
            <h1 style="color: #51067d;">Usefuns Official</h1>
            <p>Meet new friends and join live party.</p>
            <h3 style="color: #cc0000;">Route or API requested is not found.</h3>
        </body>
        </html>
    `)
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

module.exports = app;