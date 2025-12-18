const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));
app.use('/style', express.static('style'));
app.use('/img', express.static('img'));

const levelsPath = path.join(__dirname, 'levels.json');
const levelsData = fs.readFileSync(levelsPath);
const levels = JSON.parse(levelsData);