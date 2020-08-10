const express = require('express');
const { fork } = require('child_process');
const open = require('open');

const port = 3000;
const app = express();

const scanner = fork('./src/scanner.js');
let scannerState;
scanner.on('message', msg => {
  scannerState = msg;
});

// for handling JSON POST queries
app.use(express.json());

// http server routes

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.post('/start', (req, res) => {
  const accounts = (req.body.accounts || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split(' ');
      return {
        username: parts[0],
        password: parts[1],
      };
    });

  const zipcodes = (req.body.zipcodes || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // startScanner(accounts, zipcodes);
  scanner.send({ func: 'start', accounts, zipcodes });
  res.send({ status: 'ok' });
});

app.get('/stop', (req, res) => {
  scanner.send({ func: 'stop' });
});

app.get('/data', (req, res) => {
  scanner.send({ func: 'getState' });

  // wait a little bit so that forked scanner sends a state
  setTimeout(() => {
    if (scannerState) {
      res.send(scannerState);
    } else {
      res.send({});
    }
  }, 50);
});

// serve static files under ui directory
app.use(express.static('ui'));

// start http server
app.listen(port, async () => {
  const url = `http://localhost:${port}`;
  console.log(`Open this address with your browser: ${url}`);

  // Open URL automatically in the default browser
  open(url);
});
