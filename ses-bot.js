import fs from 'fs'
import path from 'path'
import SES from 'ses'
import debug from 'debug'
import EventEmitter from 'events'
import chalk from 'chalk'
import PQueue from 'p-queue'
import createNode from '@beaker/dat-node'

class SesBot extends EventEmitter {}

const sesBot = new SesBot()

const debugLog = debug('ses-bot')

const r = SES.makeSESRootRealm()

debugLog('Debug on')

function buildBotKernelSrc () {
  let def, log, debugLog

  function kernel () {
    let pidCounter = 0
    let messageCounter = 0
    let handlers = []
    let state = []
    const definitions = {
      register: (botName, handlerFunc) => {
        const pid = ++pidCounter
        handlers[pid] = {
          botName,
          handlerFunc,
          queue: new PQueue({concurrency: 1})
        }
        debugLog('Registered handler at PID:', pid, botName, handlerFunc)
        return pid
      },
      send: message => {
        const id = 'm' + ++messageCounter
        debugLog(id, `Message:`, message)
        const promises = handlers.map((handler, pid) => {
          const {botName, handlerFunc, killed, queue} = handler
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
              const promise = SES.confine(
                `${handlerFunc};
                 module.exports(botName, message, state)`,
                {
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
                      emit(message)
                    }
                  },
                  sleep: delay => new Promise(resolve => {
                    setTimeout(resolve, delay)
                  })
                }
              )
              return promise.then(result => {
                handlerLog('Success:', result)
                return {result}
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
        return Promise.all(promises)
          .then(results => {
            debugLog(id, 'Handlers finished')
            return results
          })
      },
      getLastPid: () => pidCounter,
      ps: () => handlers,
      kill: id => handlers[id].killed = true,
    }
    return def(definitions) // Freeze 'em
  }

  return `${kernel}; kernel()`
}

const botKernel = r.evaluate(buildBotKernelSrc(), {
  log: console.log,
  debugLog,
  emit,
  chalk,
  setTimeout,
  PQueue
})

function emit (message) {
  sesBot.emit('message', message)
}

export function registerRootBot(nick) {
  const rootBotFile = path.resolve(__dirname, 'root-bot.js')
  const rootBotSource = fs.readFileSync(rootBotFile, 'utf8')
  botKernel.register(nick, rootBotSource)
}

export function send (message) {
  botKernel.send(message)
}

export default sesBot

