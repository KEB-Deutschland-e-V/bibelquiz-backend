const fs = require('fs')

const express = require('express')
const bodyParser = require('body-parser')
const https = require('https')
const http = require('http')

const cors = require('cors')

const Config = require('sigmundd-config')
const Log = require('sigmundd-log')
const Metrics = require('sigmundd-metrics')
const security = require('sigmundd-security')
const version = require('./package.json').version


let config = new Config(process.env.PWD)
let log = new Log(config.log)

log.debug('Config: ' + JSON.stringify(config))

let metrics = new Metrics.Metrics(config.metrics)

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

metrics.addCustomMetric({
  name: 'version',
  help: 'Version of this Service',
  labelNames: ['version']
}, Metrics.MetricType.GAUGE);
metrics.customMetrics['version'].labels(version).set(1)

metrics.addCustomMetric({
  name: 'difficulties',
  help: 'Number of Difficulties in System'
}, Metrics.MetricType.GAUGE);
metrics.addCustomMetric({
  name: 'questions',
  help: 'Number of Questions in System'
}, Metrics.MetricType.GAUGE);

metrics.addCustomMetric({
  name: 'answers_right',
  help: 'Right Answers'
}, Metrics.MetricType.COUNTER);
metrics.addCustomMetric({
  name: 'answers_wrong',
  help: 'Wrong Answers'
}, Metrics.MetricType.COUNTER);
metrics.addCustomMetric({
  name: 'answers_total',
  help: 'Total Answers'
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'highscores_total',
  help: 'Total Number of Highscores'
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'highscores_by_difficulty',
  help: 'Number of Highscores by Difficulty labeled',
  labelNames: ['difficulty']
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'highscores_values_total',
  help: 'Total Value of Highscores'
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'highscores_values_by_difficulty',
  help: 'Value of Highscores by Difficulty labeled',
  labelNames: ['difficulty']
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'last_highscore_value',
  help: 'Last Value of Highscores'
}, Metrics.MetricType.GAUGE);

const mysql = require('mysql2');
let connection;
let difficulties = []
let questions = []
try {
  connection = mysql.createConnection(config.database);
  connection.query(
    'SELECT id, name FROM difficulties',
    function(err, results) {
      if (err) {
        log.error(err)
        process.exit(2)
      } else {
        difficulties = results;
        metrics.customMetrics['difficulties'].set(difficulties.length)
        connection.query(
          'SELECT * FROM questions',
          function(err, results2) {
            if (err) {
              log.error(err)
              process.exit(3)
            } else {
              questions = results2;
              metrics.customMetrics['questions'].set(questions.length)
            }
          }
        );

      }
    }
  );
} catch (error) {
  log.error(error)
  process.exit(1)
}


let app = express()

app.use(metrics.collect)
app.use(security(config.security))
app.use(bodyParser.json())

app.use(cors(corsOptions))



app.get('/_version', (req, res) => {
  res.send(version)
})

app.get('/_health', (req, res) => {
  res.sendStatus(200)
})

app.get('/_ready', (req, res) => {
  if (difficulties.length > 0 && questions.length > 0) {
    res.sendStatus(200)
  } else {
    res.sendStatus(503)
  }
})

app.get('/difficulties', (req, res) => {
  log.debug('Get /difficulties')
  res.json(difficulties)
})

app.get('/questions', (req, res) => {
  log.debug('Get /questions')
  res.json(questions)
})

app.get('/highscores/:difficulty', (req, res) => {
  log.debug('Get /highscores/' + req.params.difficulty)
  connection.query(
    'SELECT username, score FROM highscores WHERE difficulty=' + req.params.difficulty + ' ORDER BY score DESC',
    function(err, results) {
      if (err) {
        log.error(err)
        res.status(500).json(err)
      } else {
        res.json(results)
      }
    }
  );
})

app.get('/highscores', (req, res) => {
  log.debug('Get /highscores/')
  connection.query(
    'SELECT username, score, difficulty FROM highscores ORDER BY difficulty, score DESC',
    function(err, results) {
      if (err) {
        log.error(err)
        res.status(500).json(err)
      } else {
        res.json(results)
      }
    }
  );
})

app.post('/highscore', (req, res) => {
  log.debug('Trying to enter Highscore: ' + JSON.stringify(req.body))
  metrics.customMetrics['highscores_total'].inc()
  metrics.customMetrics['highscores_by_difficulty'].labels(req.body.difficulty).inc()
  metrics.customMetrics['highscores_values_total'].inc(req.body.score)
  metrics.customMetrics['highscores_values_by_difficulty'].labels(req.body.difficulty).inc(req.body.score)
  metrics.customMetrics['last_highscore_value'].set(req.body.score)
  connection.execute(
    'INSERT INTO `highscores` (username, score, difficulty) VALUES (?,?,?)',
    [req.body.username, req.body.score, req.body.difficulty],
    function(err, results, fields) {
      if (err) {
        res.status(500).json(err)
        log.error(err.message)
      } else {
        log.debug('Highscore entered: ' + JSON.stringify(req.body))
        res.sendStatus(201)
      }
    }
  );
})

app.get('/stats', (req, res) => {
  log.debug('Trying to get stats');
  connection.query(
    'SELECT * FROM question_stats',
    function(err, results) {
      if (err) {
        log.error(err)
        res.status(500).json(err)
      } else {
        log.debug('Getting Stats OK');
        res.json(results)
      }
    }
  );
})

app.post('/stat', (req, res) => {
  metrics.customMetrics['answers_total'].inc()
  if (req.body.correct === '1') {
    metrics.customMetrics['answers_right'].inc()
  } else {
    metrics.customMetrics['answers_wrong'].inc()
  }
  log.debug('Trying to enter stat: ' + JSON.stringify(req.body))
  connection.execute(
    'INSERT INTO `question_stats` (question, answer, correct) VALUES (?,?,?)',
    [req.body.question, req.body.answer, req.body.correct],
    function(err, results, fields) {
      if (err) {
        log.error(err)
        res.status(500).json(err)
      } else {
        log.debug('Stat entered: ' + JSON.stringify(req.body))
        res.sendStatus(201)
      }
    }
  );
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
