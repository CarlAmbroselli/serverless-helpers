const errorMailer = require('./errorMailer/index').errorMailer
const Storage = require('./storage/dropbox')

module.exports = {
  errorMailer,
  Storage
}