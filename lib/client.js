'use strict'

module.exports = Client

const orm = require('./connection')
const uuid = require('uuid')
const Token = require('./token')

function Client (opts) {
  this.id = opts.id
  this.client_id = opts.client_id
  this.client_secret = opts.client_secret
  this.email = opts.email
  this.name = opts.name
  this.homepage = opts.homepage
  this.description = opts.description
  this.callback = opts.callback
  this.webhook = opts.webhook
  this.type = opts.type
  this.created = opts.created
  this.deleted = opts.deleted
}

Client.prototype = {
  // set the deleted field on a client
  // and all of the tokens generated for
  // said client.
  softDelete () {
    var _this = this
    return Token.objects.filter({
      client_id: this.id
    }).update({
      deleted: new Date()
    }).then(function () {
      return Client.objects.filter({
        client_id: _this.client_id
      }).update({
        deleted: new Date()
      })
    }).then(function () {
      return Client.objects.get({
        client_id: _this.client_id
      })
    })
  }
}

Client.objects = orm(Client, {
  id: orm.joi.number(),
  client_id: orm.joi.string().default(uuid.v4, 'uuid v4'),
  client_secret: orm.joi.string().default(uuid.v4, 'uuid v4'),
  name: orm.joi.string(),
  email: orm.joi.string().regex(/@/),
  homepage: orm.joi.string(),
  description: orm.joi.string(),
  callback: orm.joi.string(),
  webhook: orm.joi.string(),
  type: orm.joi.string(),
  created: orm.joi.date().default(function () {
    return (new Date()).toISOString()
  }, 'date'),
  deleted: orm.joi.date()
})
