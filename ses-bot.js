import fs from 'fs'
import path from 'path'
import SES from 'ses'
import debug from 'debug'
import EventEmitter from 'events'
import chalk from 'chalk'
import PQueue from 'p-queue'
import dedent from 'dedent'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import parseDatUrl from 'parse-dat-url'
import {createNode} from '@beaker/dat-node'

class SesBot extends EventEmitter {}

const sesBot = new SesBot()

const debugLog = debug('ses-bot')

const r = SES.makeSESRootRealm()

debugLog('Debug on')

function buildBotKernelSrc () {
  let def, log, debugLog

  function kernel () {
    let messageCounter = 0
    let processes = []
    let state = []
    let storageDir

    const definitions = {
      setStorageDir: dir => storageDir = dir,
      register,
      send,
      kill: id => processes[id].killed = true,
    }
    return def(definitions) // Freeze 'em

    function register (botName, handlerFunc) {
      const pid = processes.length
      processes[pid] = {
        botName,
        handlerFunc,
        queue: new PQueue({concurrency: 1})
      }
      debugLog('Registered handler at PID:', pid, botName, handlerFunc)
      return pid
    }

    function send (message, cb) {
      const id = 'm' + ++messageCounter
      debugLog(id, `Message:`, message)
      const promises = processes.map((proc, pid) => {
        const {botName, handlerFunc, killed, queue} = proc
        const {author} = message
        if (killed) return
        if (author === botName) return
        const promise = queue.add(() => getPromise())
        return promise

        function handlerLog () {
          debugLog(`${id} PID ${pid}`, ...arguments)
        }

        function getPromise () {
          try {
            handlerLog('State:', state[pid])
            const endowments = {
              module: {},
              console: {
                log: (...rest) => {
                  handlerLog('Log:', ...rest)
                  log(chalk.blue(`PID ${pid} ${botName}:`), ...rest)
                }
              },
              botName,
              message,
              state: state[pid],
              setState: newState => state[pid] = newState,
              chat: {
                send: message => {
                  handlerLog('Emit:', message)
                  if (!message.options || !message.options.username) {
                    if (!message.options) message.options = {}
                    message.options.username = botName
                  }
                  emit(message)
                }
              },
              sleep: delay => new Promise(resolve => {
                setTimeout(resolve, delay)
              }),
              dedent
            }
            if (pid === 0) { // Root bot extra endowments
              Object.assign(endowments, {
                admin: {
                  ps: () => processes,
                  register: async (botName, url) => {
                    // FIXME: Only one at a time
                    debugLog('Register', botName, url)
                    const pid = processes.length
                    try {
                      const botDir = path.join(storageDir, 'bots', `${pid}`)
                      rimraf.sync(botDir)
                      mkdirp.sync(botDir)
                      debugLog('Dir', botDir)
                      const sourceDatDir = path.join(botDir, 'sourceDat')
                      const dat = createNode({path: sourceDatDir})
                      const {host, pathname} = parseDatUrl(url)
                      const archive = await dat.getArchive(host)
                      const js = await archive.readFile(pathname, 'utf8')
                      await dat.close()
                      debugLog('Source', js)
                      register(botName, js)
                      processes[pid].url = url
                      return [null, pid]
                    } catch (e) {
                      debugLog('Error', e)
                      return [e, null]
                    }
                  },
                  kill: pid => {
                    if (!processes[pid]) {
                      return new Error('Process does not exist')
                    }
                    processes[pid].killed = true
                  },
                  resurrect: pid => {
                    if (!processes[pid]) {
                      return new Error('Process does not exist')
                    }
                    if (!processes[pid].killed) {
                      return new Error('Process was not terminated')
                    }
                    processes[pid].killed = false
                  }
                }
              })
            }
            return SES
              .confine(
                `${handlerFunc}; module.exports(botName, message, state)`,
                endowments
              )
              .then(result => {
                handlerLog('Success:', result)
                return {result}
              })
              .catch(err => {
                handlerLog('Fail:', err.name, err.message, err.stack)
                log(chalk.red(`PID ${pid} ${botName}:`), e.name + ':', e.message)
              })
          } catch (e) {
            const err = {
              name: e.name,
              message: e.message,
              code: e.code,
              stack: e.stack
            }
            handlerLog('Fail:', err)
            log(chalk.red(`PID ${pid} ${botName}:`), e.name + ':', e.message)
            return Promise.resolve({error: err})
          }
        }
      })
      const allPromises = Promise.all(promises)
        .then(results => {
          debugLog(id, 'Handlers finished')
          cb(null, results)
        })
        .catch(err => {
          debugLog(id, 'Error', err)
          cb(err)
        })
      return allPromises
    }
  }

  return `${kernel}; kernel()`
}

const botKernel = r.evaluate(buildBotKernelSrc(), {
  log: console.log,
  debugLog,
  emit,
  chalk,
  setTimeout,
  PQueue,
  dedent,
  path,
  rimraf,
  mkdirp,
  parseDatUrl,
  createNode
})

function emit (message) {
  sesBot.emit('message', message)
}

export function registerRootBot(nick, dir) {
  const rootBotFile = path.resolve(__dirname, 'root-bot.js')
  const rootBotSource = fs.readFileSync(rootBotFile, 'utf8')
  botKernel.setStorageDir(dir)
  botKernel.register(nick, rootBotSource)
}

export function send (message, cb) {
  botKernel.send(message, cb)
}

export default sesBot

