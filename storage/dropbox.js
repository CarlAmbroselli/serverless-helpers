'use strict';

const uuidv4 = require('uuid/v4');
const { parse } = require('json2csv');
const csvtojson = require('csvtojson')
const json2csv = require('json2csv').parse;
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
const retry = require('async-retry')
const path = require('path');
const request = require('request');
const queue = require('async/queue');
const db = require('dropbox-stream');

class Storage {

  constructor(accessToken) {
    // When used across you serverless functions it is easiest to just store it in an environment variable
    accessToken = accessToken || process.env.DROPBOX_TOKEN
    if (!accessToken) {
      throw("No accessToken specified set!")
    }

    this.accessToken = accessToken;
    
    this.dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch
    })
    
    // Dropbox will throw errors when we try to upload too many files in parallel
    this.uploadQueue = queue((task, callback) => {
        this._uploadTask(task).then(callback).catch(error => callback({error}))
    }, 5);

    // Dropbox will throw errors when we try to download too many files in parallel
    this.downloadUploadQueue = queue((task, callback) => {
        this._downloadAndUploadFromUrl(task).then(callback).catch(error => callback({error}))
    }, 5);

  }

  async fileExists(file) {
   return new Promise((resolve, reject) => {
      this.dbx.filesGetMetadata({
        path: file,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false
      }).then(x => resolve(x)).catch(e => {
        if (!e || !e.error || !e.error.error_summary) {
          reject(e)
          return
        }
        let tag = e.error.error_summary
        if (tag.indexOf('not_found') > -1) {
          resolve(false)
        } else {
          console.log("Error for ", file)
          reject(e)
        }
      })
    })
  }

  async getTemporaryLink(path) {
    return this.dbx.filesGetTemporaryLink({ path }).then(x => x.link)
  }

  async getAllFilesInDir(folder) {
    let response = await this.dbx.filesListFolder({
        path: folder,
        limit: 2000
      })
    let files = response.entries
    let cursor = response.cursor
    let hasNext = response.has_more
    while (hasNext) {
      response = await this.dbx.filesListFolderContinue({
        cursor: cursor
      })
      console.log('Loading more files... Currently loaded: ' + files.length)
      files = files.concat(response.entries)
      cursor = response.cursor
      hasNext = response.has_more
    }
    return files
  }

  async ensureDirectoryExists(filePath) {
    var dirname = path.dirname(filePath);
    if (dirname === '/') {
      return Promise.resolve()
    }
    return new Promise(async (resolve, reject) => {
      let fileExists = await this.fileExists(dirname)
      if (fileExists) {
        resolve(fileExists)
      } else {
        let result = await this.dbx.filesCreateFolderV2({
          path: dirname,
          autorename: false
        })
        resolve(result)
      }
    })
  }

  async getCsvAsObject(remoteLocation) {
    try {
      let file = await this.getFileAsString(remoteLocation)
      return csvtojson({delimiter: 'auto'}).fromString(file)
    } catch(e) {
      throw("File not found.")
    }
  }

  async getFileAsString(remoteLocation) {
    return new Promise((resolve, reject) => {
      return this.dbx.filesDownload({
        path: remoteLocation
      }).then(resp => {
            let buffer = Buffer.from(resp.fileBinary);
            resolve(buffer.toString())
        }).catch(reject)
    })
  }

  async downloadFile(remoteLocation, localLocation) {
    return new Promise((resolve, reject) => {
      return this.dbx.filesDownload({
        path: remoteLocation
      }).then(resp => {
            let buffer = Buffer.from(resp.fileBinary);
            var wstream = fs.createWriteStream(localLocation);
            wstream.on('finish', function () {
              resolve()
            });
            wstream.write(buffer);
            wstream.end();
        })
    })
  }

  async uploadFromUrl(url, destination, customHeaders) {
    if (!customHeaders) {
      return this._uploadFromUrl(url, destination)
    } else {
      return new Promise(async (resolve, reject) => {
        console.log("Currently waiting in download queue: ", this.downloadUploadQueue.length())
        this.downloadUploadQueue.push({url, destination, customHeaders}, (result) => {
          if (result && result.error) {
            reject(result.error)
          } else {
            resolve(result)
          }
        })
      })
    }
  }

  async _downloadAndUploadFromUrl(task) {
    let {url, destination, customHeaders} = task
    return new Promise(async (resolve, reject) => {
      const upStream = db.createDropboxUploadStream({
        token: this.accessToken,
        path: destination,
        chunkSize: 1000 * 1024,
        autorename: false,
        mode: 'overwrite'
      })
      .on('error', err => reject(err))
      .on('progress', res => console.log("Upload progress: " + res))
      .on('metadata', metadata => resolve(metadata))

      var options = {
        url: url,
        headers: customHeaders
      };
      request(options).pipe(upStream)
    })
  }

  async _uploadFromUrl(url, destination) {
    // This save_url endpoint does not support overwriting an existing file, so we have to delete the current file
    let exists = await this.fileExists(destination)
    if (exists) {
      await this.dbx.filesDeleteV2({
        path: destination
      })
    }
    return this.dbx.filesSaveUrl({
      path: destination,
      url: url
    })
  }


  async uploadText(data, destination) {
    return new Promise(async (resolve, reject) => {
      console.log("Currently waiting in upload queue: ", this.uploadQueue.length())
      this.uploadQueue.push({
        data,
        destination
      }, (result) => {
        if (result && result.error) {
          reject(result.error)
        } else {
          resolve(result)
        }
      })
    })
  }

  async _uploadTask(task) {
    let data = task.data
    let destination = task.destination
    try {
      let result = await retry(async bail => {
        return new Promise(async (resolve, reject) => {
          await this.ensureDirectoryExists(destination)
          let uploadOpts = {
            path: destination,
            contents: data,
            mode: {
              '.tag': 'overwrite'
            }
          }
          this.dbx.filesUpload(uploadOpts).then(resolve).catch(reject)
        }, {
        retries: 5
        })
      })
      return result
    } catch(e) {
      return Promise.reject(e)
    }
  }

  async uploadArrayAsCSV(object, destination) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(object) || object.length == 0) {
          reject("Supplied object cannot be saved as csv since it is not an array or an empty erray.")
        } else {
          this.uploadText(json2csv(object), destination).then(resolve).catch(reject)
        }
      })
  }


  async uploadFile (file, destination) {
    return new Promise((resolve, reject) => {
      try {
        fs.readFile(file, (err, data) => {
            err ? reject(err) : this.uploadText(data, destination).then(resolve).catch(reject)
        })
      } catch(e) {
        reject(e)
      }
    })
  }
  
  async appendToCsv(newContent, remoteFile) {
      let tempFile = '/tmp/' + uuidv4() + '.csv'
      await this.downloadFile(remoteFile, tempFile)
      let existingContent = await csvtojson({delimiter: 'auto'}).fromFile(tempFile);
      fs.unlinkSync(tempFile)
      let newKeys = Object.keys(newContent).sort()
      let existingKeys = Object.keys(existingContent[0]).sort()

      if (JSON.stringify(existingKeys) !== JSON.stringify(newKeys)) {
        throw `[${remoteFile}] Existing file has different keys then object to append, failed.`
      }
      
      existingContent.push(newContent)
      const csv = parse(existingContent, {fields: existingKeys})
      let newTempFile = '/tmp/' + uuidv4() + '.csv'
      await new Promise((resolve, reject) => {
        fs.writeFile(newTempFile, csv, (err) => {
          if (err)  {
            console.log(err)
            throw err
          } else {
            this.uploadFile(newTempFile, remoteFile).then(resolve).catch(reject)
          }
        })
      })
  }

  async mergeCsv(localFile, remoteFile, primaryKey, deduplicateInputFirst=false) {
    let filename = remoteFile.split('/').slice(-1).pop()
    let fileExists = await this.fileExists(remoteFile)
    if (!fileExists) {
      await this.uploadFile(localFile, remoteFile)
    } else {
      let tempFile = '/tmp/' + uuidv4() + '.csv'
      await this.downloadFile(remoteFile, tempFile)
      let existingContent = await csvtojson({delimiter: 'auto'}).fromFile(tempFile);
      fs.unlinkSync(tempFile)
      let newContent = await csvtojson({delimiter: 'auto'}).fromFile(localFile);

      if (existingContent.length == 0) {
        await this.uploadFile(localFile, remoteFile)
        return
      } else if (newContent.length == 0) {
        return
      }

      let existingKeys = Object.keys(existingContent[0]).sort()
      let newKeys = Object.keys(newContent[0]).sort()

      if (JSON.stringify(existingKeys) !== JSON.stringify(newKeys)) {
        throw `[${filename}] Existing file has different keys then new file, failed to merge csv's`
      }

      if (primaryKey && existingKeys.indexOf(primaryKey) == -1) {
        console.log("Primary Key Error:", tempFile, remoteFile, primaryKey, existingKeys)
        throw `[${filename}] Primary key not found in the csv when attempting to merge.`
      }

      let useWholeRowAsKey = false
      if (existingKeys.indexOf(primaryKey) == -1) {
        console.log(`[${filename}] Did not specify a primary key for ${remoteFile}, comparing whole row`)
        primaryKey = 'temporaryTemporyKeyColumn'
        useWholeRowAsKey = true
        newContent = newContent.map(row => {
          row[primaryKey] = JSON.stringify(row, Object.keys(row).sort())
          return row
        })
        existingContent = existingContent.map(row => {
          row[primaryKey] = JSON.stringify(row, Object.keys(row).sort())
          return row
        })
      }
      
      // in case we have duplicate data in the source
      if (deduplicateInputFirst) {
        let filteredContent = []
        let seenKeys = new Set();
        newContent.map(x => {
          if (!seenKeys.has(x[primaryKey])) {
            filteredContent.push(x)
            seenKeys.add(x[primaryKey])
          }
        })
      	newContent =  filteredContent
      }

      if (newContent.length !== [...new Set(newContent.map(x => x[primaryKey]))].length) {
        throw `[${filename}] Found duplicate rows with same primary key in localFile when merging csv's`
      }

      if (existingContent.length !== [...new Set(existingContent.map(x => x[primaryKey]))].length) {
        let duplicateItems = existingContent.filter(x => existingContent.filter(y => x[primaryKey] == y[primaryKey]).length > 1)
        throw `[${filename}] Found duplicate rows with same primary key in remoteFile when merging csv's for key: ${primaryKey} in remoteFile: ${remoteFile}. Duplicates: ${duplicateItems}`
      }

      const compareKey = (a, b) => {
        if (a[primaryKey] < b[primaryKey])
          return -1;
        if (a[primaryKey] > b[primaryKey])
          return 1;
        return 0;
      };

      newContent = newContent.sort(compareKey);
      existingContent = existingContent.sort(compareKey);

      let mergedContent = []
      while(newContent.length > 0 || existingContent.length > 0) {
        if (newContent.length == 0 && existingContent.length > 0) {
          let newValue = existingContent[0]
          mergedContent.push(newValue)
          existingContent.shift()
        } else if (existingContent.length == 0 && newContent.length > 0) {
          let newValue = newContent[0]
          mergedContent.push(newValue)
          newContent.shift()
        } else if (newContent[0][primaryKey] == existingContent[0][primaryKey]) {
          let newValue = newContent[0]
          mergedContent.push(newValue)
          newContent.shift()
          existingContent.shift()
        } else if (newContent[0][primaryKey] < existingContent[0][primaryKey]) {
          let newValue = newContent[0]
          mergedContent.push(newValue)
          newContent.shift()
        } else if (newContent[0][primaryKey] > existingContent[0][primaryKey]) {
          let newValue = existingContent[0]
          mergedContent.push(newValue)
          existingContent.shift()
        } else {
          throw "Unexpectedly reached else condition."
        }
      }

      if (useWholeRowAsKey) {
        mergedContent = mergedContent.map(row => {
          delete row[primaryKey]
          return row
        })
      }

      const csv = parse(mergedContent, {fields: existingKeys})
      let newTempFile = '/tmp/' + uuidv4() + '.csv'
      await new Promise((resolve, reject) => {
        fs.writeFile(newTempFile, csv, (err) => {
          if (err)  {
            console.log(err)
            throw err
          } else {
            this.uploadFile(newTempFile, remoteFile).then((result) => {
              fs.unlinkSync(newTempFile)
              resolve(result)
            }).catch((result) => {
              fs.unlinkSync(newTempFile)
              reject(result)
            })
          }
        })
      })

    }
  }
}

module.exports = Storage