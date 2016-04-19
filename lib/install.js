const _ = require('lodash')
const request = require('request')
const Promise = require('bluebird')
const figures = require('figures')
const exec = require('child_process').exec

const prefix = 'npm-addon-'
const resolve = require('url').resolve

exports.command = 'install <addon>'
exports.describe = 'installs a new OAuth 2.0 client from a package'
exports.builder = function (yargs) {
  return yargs
    .option('registry', {
      alias: 'r',
      describe: 'npm registry URL',
      default: 'https://registry.npmjs.org'
    })
    .option('port', {
      alias: 'p',
      describe: 'port server is running on',
      default: 8084
    })
}

exports.handler = function (argv) {
  var addon = prefix + argv.addon
  var meta = null
  var client = null

  exists(addon, argv)
    .then(function () {
      console.info(figures.tick + ' found addon "' + argv.addon + '"')
      return install(addon, argv)
    })
    .then(function () {
      console.info(figures.tick + ' installed addon "' + argv.addon + '"')
      meta = require(addon)
      return createClient(meta, argv)
    })
    .then(function (_client) {
      client = _client
      console.info(figures.tick + ' generated client for "' + argv.addon + '"')
      return createToken(client, argv)
    })
    .then(function (token) {
      console.info(figures.tick + ' generated access token for "' + argv.addon + '"')
      return sendToken(client, token, argv)
    })
    .then(function () {
      console.info('\\o/ addon "' + argv.addon + '" successfully installed')
    })
    .catch(function (err) {
      console.error(err.message)
    })
}

function exists (addon, argv) {
  const deferred = Promise.defer()

  request.get(resolve(argv.registry, addon), function (err, res) {
    if (err) return deferred.reject(err)
    if (res.statusCode >= 400) {
      var msg = figures.cross + ' could not find addon "' + argv.addon + '" in registry ' + argv.registry
      return deferred.reject(Error(msg))
    }
    return deferred.resolve()
  })

  return deferred.promise
}

function install (addon, argv) {
  const deferred = Promise.defer()

  console.info('running npm install for ' + argv.addon + ' ' + figures.ellipsis)
  exec('npm install ' + addon + '@latest --registry=' + argv.registry, function (err, stdout, stderr) {
    var errMessage = null
    if (err) errMessage = err.message
    if (stderr) errMessage = stderr
    if (errMessage) {
      var msg = figures.cross + ' failed to install ' + argv.addon
      return deferred.reject(Error(msg))
    }
    return deferred.resolve()
  })

  return deferred.promise
}

function createClient (meta, argv) {
  const deferred = Promise.defer()

  request.post({
    url: 'http://localhost:' + argv.port + '/client',
    json: true,
    qs: {
      sharedFetchSecret: process.env.SHARED_FETCH_SECRET
    },
    body: meta
  }, (err, res, client) => {
    if (err || res.statusCode >= 400) {
      var msg = figures.cross + ' failed to generate client for "' + argv.addon + '"'
      return deferred.reject(Error(msg))
    }
    return deferred.resolve(client)
  })

  return deferred.promise
}

function createToken (client, argv) {
  const deferred = Promise.defer()

  request.post({
    url: 'http://localhost:' + argv.port + '/client/' + client.client_id + '/token',
    json: true,
    qs: {
      sharedFetchSecret: process.env.SHARED_FETCH_SECRET
    },
    body: {
      user_email: process.env.BILLING_EMAIL
    }
  }, (err, res, token) => {
    if (err || res.statusCode >= 400) {
      var msg = figures.cross + ' failed to generate access token for "' + argv.addon + '"'
      return deferred.reject(Error(msg))
    }
    return deferred.resolve(token)
  })

  return deferred.promise
}

function sendToken (client, token, argv) {
  const deferred = Promise.defer()

  request.post({
    url: client.callback,
    json: true,
    body: _.pick(token, [
      'refresh_token',
      'access_token',
      'refresh_expires',
      'access_expires'
    ])
  }, (err, res, client) => {
    if (err || res.statusCode >= 400) {
      var msg = figures.cross + ' failed to deliver access token for "' + argv.addon + '"'
      return deferred.reject(Error(msg))
    }
    return deferred.resolve(client)
  })

  return deferred.promise
}