const Storage = require('../storage/dropbox')

function storeOutput(functionName, result, outputPath="/data/data-health") {
  if (outputPath.charAt(outputPath.length - 1) !== '/') {
    outputPath = outputPath + '/'
  }
  let storage = new Storage()
  return storage.uploadArrayAsCSV([{
    "timestamp": (new Date()).toISOString(),
    "result": result
  }], outputPath + functionName + '.csv')
}

function toOutputStoringAsyncFunction(func, functionName, outputPath="/data/data-health") {
  return function () {
    return new Promise((resolve, reject) => {
      const nameToStore = functionName || func.name
      const result = func.apply(null, Array.from(arguments));
      if (result instanceof Promise) {
        result.then(async (value) => {
          await storeOutput(nameToStore, value, outputPath)
          return value
        }).then(resolve).catch(reject)
      } else {
        storeOutput(nameToStore, result, outputPath).then(() => {
          resolve(result)
        }).catch(e => reject(e))
      }
    });
  };
}

module.exports = {
  toOutputStoringAsyncFunction
}