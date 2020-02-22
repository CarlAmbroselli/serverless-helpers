function CatchedException(message) {
  this.message = message;
  this.name = "CatchedException";
}

class Catcher {
  constructor (failFunc = this.failFunDefault) {
    this.fail = failFunc
  }

  isAsync (fn) {
    const AsyncFunction = (async () => {}).constructor
    return fn instanceof AsyncFunction === true
  }

  // Default catch
  failFunDefault (error, func, args) {
    console.log("" +
      "Error! " + func.name + " failed!" +
      "The parameters were: " + JSON.stringify(args)  +
      "The error thrown was: " + error +
    "")
  }

  /** Make any function failsafe */
  catchErrors (func, fail) {
    let catchErrorsFun
    if (this.isAsync(func)) {
      catchErrorsFun = async function () {
        try {
          await func.apply(this, arguments)
        } catch (e) {
          if (fail) {
            if (e && !e.name === "CatchedException") {
              fail.apply(this, [e, func, arguments])
              throw new CatchedException(e)
            } else {
              throw new CatchedException(e.message)
            }
          }
        }
      }
    } else {
      catchErrorsFun = function () {
        try {
          func.apply(this, arguments)
        } catch (e) {
          if (fail) {
            if (e && !e.name === "CatchedException") {
              fail.apply(this, [e, func, arguments])
              throw new CatchedException(e)
            } else {
              throw new CatchedException(e.message)
            }
          }
        }
      }
    }

    return catchErrorsFun
  }

  getAllMethodNames (obj) {
    let methods = []
    while (obj = Reflect.getPrototypeOf(obj)) {
      let keys = Reflect.ownKeys(obj)
      keys.forEach((k) => methods.push(k))
    }
    return methods
  }

  /** Make all methods on any Object resistent */
  catchAll (bareObj) {
    const methods = this.getAllMethodNames(bareObj)
    methods.forEach((functionName) => {
      const unsafeFunction = bareObj[functionName]
      bareObj[functionName] = this.catchErrors(unsafeFunction, this.fail)
    })
  }

}

module.exports = Catcher
