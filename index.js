const { errorMailer } = require('./errorMailer/index')
const Storage = require('./storage/dropbox')
const { toOutputStoringAsyncFunction } = require('./logWriter/index')

module.exports = {
  errorMailer,
  Storage,
  toOutputStoringAsyncFunction
}