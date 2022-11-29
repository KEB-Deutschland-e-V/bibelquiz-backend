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

const DeviceDetector = require("device-detector-js");
const deviceDetector = new DeviceDetector();


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
  name: 'gamemodes',
  help: 'Number of Gamemodes in System'
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

metrics.addCustomMetric({
  name: 'impressions_total',
  help: 'How many impressions on start page',
}, Metrics.MetricType.GAUGE);
metrics.addCustomMetric({
  name: 'impressions_by_useragent',
  help: 'How many impressions by useragent on start page',
  labelNames: ['useragent']
}, Metrics.MetricType.GAUGE);
metrics.addCustomMetric({
  name: 'impressions_by_device',
  help: 'How many impressions by device on start page',
  labelNames: ['device']
}, Metrics.MetricType.GAUGE);
metrics.addCustomMetric({
  name: 'impressions_by_apptype',
  help: 'How many impressions by apptype (ios,android,web) on start page',
  labelNames: ['apptype']
}, Metrics.MetricType.GAUGE);
metrics.addCustomMetric({
  name: 'impressions_ios_noapp',
  help: 'How many impressions on ios withoout the app on start page',
}, Metrics.MetricType.GAUGE);
metrics.addCustomMetric({
  name: 'impressions_android_noapp',
  help: 'How many impressions on ios withoout the app on start page',
}, Metrics.MetricType.GAUGE);

metrics.addCustomMetric({
  name: 'right_answers',
  help: 'Right Answers given',
  labelNames: ['question']
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'wrong_answers',
  help: 'Wrong Answers given',
  labelNames: ['question']
}, Metrics.MetricType.COUNTER);

metrics.addCustomMetric({
  name: 'wrong_answers_percentage',
  help: 'Wrong Answers given in Percentage',
  labelNames: ['question']
}, Metrics.MetricType.COUNTER);

const mysql = require('mysql2');
let connection;
let difficulties = []
let questions = []
let hash = 0

try {
  connection = mysql.createConnection(config.database);
} catch (error) {
  log.error('Could not connect to database: ' + error)
  process.exit(1)
}

loadQuestions();
setInterval(loadQuestions, config.reloadinterval);

let app = express()

app.use(metrics.collect)
app.use(security(config.security))
app.use(bodyParser.json())

app.use(cors(corsOptions))



app.get('/_version', (req, res) => {
  res.send(version)
})
app.get('/_version.json', (req, res) => {
  res.json({
    version: version
  })
})
app.get('/_version_motor.json', (req, res) => {
  res.json([{
    version: version
  }])
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

app.get('/gamemodes', (req, res) => {
  log.debug('Get /gamemodes')
  res.json(gamemodes)
})

app.get('/questions', (req, res) => {
  let userAgent = req.headers['user-agent']
  // UserAgent Count
  metrics.customMetrics['impressions_by_useragent'].labels(userAgent).inc()
  // total count
  metrics.customMetrics['impressions_total'].inc()

  switch (userAgent) {
    case 'bibelquiz-ios-app':
      metrics.customMetrics['impressions_by_apptype'].labels('bibelquiz-ios-app').inc();
      break;
    case 'bibelquiz-android-app':
      metrics.customMetrics['impressions_by_apptype'].labels('bibelquiz-android-app').inc();
      break;
    default:
      metrics.customMetrics['impressions_by_apptype'].labels('web').inc();
      const device = deviceDetector.parse(userAgent);
      metrics.customMetrics['impressions_by_device'].labels(device.device.type).inc()
      // iOS No App Count
      if (device.os.name === 'iOS') {
        metrics.customMetrics['impressions_ios_noapp'].inc()
      }
      // Android No App Count
      if (device.os.name === 'Android') {
        metrics.customMetrics['impressions_android_noapp'].inc()
      }
      break;
  }

  log.debug('Get /questions')
  res.json(questions)
})
app.get('/hash', (req, res) => {
  log.debug('Get /hash')
  res.send(hash.toString())
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
    metrics.customMetrics['right_answers'].labels(req.body.question).inc()
  } else {
    metrics.customMetrics['answers_wrong'].inc()
    metrics.customMetrics['wrong_answers'].labels(req.body.question).inc()
    
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

function loadQuestions() {
  try {
    connection.query(
      'SELECT id, name, points FROM difficulties',
      function(err, results) {
        if (err) {
          log.error(err)
          process.exit(2)
        } else {
          difficulties = results;
          metrics.customMetrics['difficulties'].set(difficulties.length)
          log.debug(difficulties.length + ' Difficulties loaded')
          connection.query(
            'SELECT * FROM questions',
            function(err, results2) {
              if (err) {
                log.error(err)
                process.exit(3)
              } else {
                questions = results2;
                metrics.customMetrics['questions'].set(questions.length)
                let newhash = JSON.stringify(questions).hashCode()
                if (newhash !== hash) {
                  log.info('Questions changed! New Hash: ' + newhash)
                  hash = newhash
                }
                log.debug(questions.length + ' Questions loaded')
                connection.query(
                  'SELECT * FROM gamemodes',
                  function(err, results3) {
                    if (err) {
                      log.error(err)
                      process.exit(4)
                    } else {
                      gamemodes = results3;
                      metrics.customMetrics['gamemodes'].set(gamemodes.length)
                      log.debug(gamemodes.length + ' Gamemodes loaded')
                    }
                  }
                )
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
}
String.prototype.hashCode = function(){
	var hash = 0;
	if (this.length == 0) return hash;
	for (i = 0; i < this.length; i++) {
		char = this.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}