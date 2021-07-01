const fs = require('fs')

const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
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
  methods: 'GET,HEAD,OPTIONS,PUT,POST,DELETE',
  preflightContinue: false
}

let app = express()

app.use(security(config.security))
app.use(cookieParser())
app.use(bodyParser.json())

app.use(cors(corsOptions))


app.get('/version', (req, res) => {
  res.send(version)
})

app.get('/_health', (req, res) => {
  res.sendStatus(200)
})

app.get('/difficulties', (req, res) => {
  // TODO: read from database
})

app.get('/questions', (req, res) => {
  // TODO: read from database
})

app.get('/highscores', (req, res) => {
  // TODO: read from database
})

app.post('/highscore', (req, res) => {
  // TODO: write into database
})

app.get('/_metrics', metrics.endpoint)


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
