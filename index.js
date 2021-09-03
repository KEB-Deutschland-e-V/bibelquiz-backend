const fs = require('fs')

const express = require('express')
const bodyParser = require('body-parser')
const https = require('https')
const http = require('http')

const cors = require('cors')

const Config = require('sigmundd-config')
const Log = require('sigmundd-log')
const security = require('sigmundd-security')
const version = require('./package.json').version


let config = new Config()
let log = new Log(config.log)

log.debug('Config: ' + JSON.stringify(config))


const corsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'X-Access-Token'
  ],
  credentials: true,
  origin: '*',
  methods: 'GET,HEAD,OPTIONS,POST',
  preflightContinue: false
}

const mysql = require('mysql2');
let connection;
try {
  connection = mysql.createConnection(config.database);
} catch (error) {
  log.error(error)
  process.exit(1)
}


let app = express()

app.use(security(config.security))
app.use(bodyParser.json())

app.use(cors(corsOptions))


app.get('/version', (req, res) => {
  res.send(version)
})

app.get('/_health', (req, res) => {
  res.sendStatus(200)
})

app.get('/difficulties', (req, res) => {
  connection.query(
    'SELECT id, name FROM difficulties',
    function(err, results) {
      if (err) {
        res.status(500).json(err)
      } else {
        res.json(results)
      }
    }
  );
})

app.get('/questions', (req, res) => {
  connection.query(
    'SELECT * FROM questions',
    function(err, results) {
      if (err) {
        res.status(500).json(err)
      } else {
        res.json(results)
      }
    }
  );
})

app.get('/highscores', (req, res) => {
  connection.query(
    'SELECT * FROM highscores',
    function(err, results) {
      if (err) {
        res.status(500).json(err)
      } else {
        res.json(results)
      }
    }
  );
})

app.post('/highscore', (req, res) => {
  connection.execute(
    'INSERT INTO `highscores` (username, score, difficulty) VALUES (?,?,?)',
    [req.body.username, req.body.score, req.body.difficulty],
    function(err, results, fields) {
      if (err) {
        res.status(500).json(err)
      } else {
        res.sendStatus(201)
      }
    }
  );
})

app.get('/stats', (req, res) => {
  connection.query(
    'SELECT * FROM question_stats',
    function(err, results) {
      if (err) {
        res.status(500).json(err)
      } else {
        res.json(results)
      }
    }
  );
})

app.post('/stat', (req, res) => {
  connection.execute(
    'INSERT INTO `question_stats` (question, answer) VALUES (?,?)',
    [req.body.question, req.body.answer],
    function(err, results, fields) {
      if (err) {
        res.status(500).json(err)
      } else {
        res.sendStatus(201)
      }
    }
  );
})

app.options('*', cors(corsOptions))

let server
if (config.ssl.active) {
  server = https.createServer({
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  }, app)
} else {
  log.warn('SSL is not active. This is NOT recommended for live systems!')
  server = http.createServer(app)
}

server.listen(config.port)

log.info(`bibelquiz-backend is running on Port ${config.port}`)
