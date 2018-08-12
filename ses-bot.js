import fs from 'fs'
import path from 'path'
import SES from 'ses'
import debug from 'debug'
import EventEmitter from 'events'

class SesBot extends EventEmitter {}

const sesBot = new SesBot()

const debugLog = debug('ses-bot')

const r = SES.makeSESRootRealm()

debugLog('Debug on')

function buildBotKernelSrc () {
  let def, log

  function kernel () {
    let pidCounter = 0
    let messageCounter = 0
    let handlers = []
    let state = []
    return def({
      register: (botName, handlerFunc) => {
        const pid = ++pidCounter
        handlers[pid] = {
          botName,
          handlerFunc
        }
        log('Registered handler at PID:', pid, botName, handlerFunc)
        return pid
      },
      send: message => {
        const id = 'm' + ++messageCounter
        log(id, `Message:`, message)
        const results = handlers.map((handler, pid) => {
          const {botName, handlerFunc, killed} = handler
          const {author} = message
          if (killed) return
          if (author === botName) return
          function handlerLog () {
            log(`${id} PID ${pid}`, ...arguments)
          }
          try {
            handlerLog('State:', state[pid])
            const result = SES.confine(
              `${handlerFunc};
               module.exports(botName, message, state)`,
              {
                module: {},
                botName,
                message,
                state: state[pid],
                setState: newState => state[pid] = newState,
                emit: message => {
                  handlerLog('Emit:', message)
                  emit(message)
                },
                log: (...rest) => handlerLog('Log:', ...rest)
              }
            )
            handlerLog('Success:', result)
            return {result}
          } catch (e) {
            const err = {
              name: e.name,
              message: e.message,
              code: e.code,
              stack: e.stack
            }
            handlerLog('Fail:', err)
            return {error: err}
          }
        })
        log(id, 'Handlers finished')
        return results
      },
      getLastPid: () => pidCounter,
      ps: () => handlers,
      kill: id => handlers[id].killed = true
    })
  }

  return `${kernel}; kernel()`
}

const botKernel = r.evaluate(buildBotKernelSrc(), {
  log: debugLog,
  emit
})

function emit (message) {
  // console.log('Emit:', message)
  sesBot.emit('message', message)
}

/*
function bot1 (botName, message, state) {
  if (!state) state = {counter: 0}
  let {counter} = state
  const {channel, content, author} = message
  log(message)
  const regex = new RegExp(`^${botName}[ :] *(.*)$`)
  const match = content.match(regex)
  if (!match) return counter
  const rest = match[1]
  counter++
  emit({
    channel,
    message: `${author}: Echo "${rest}"`
  })
  setState({counter})
  return counter
}
*/

export function registerRootBot(nick) {
  const rootBotFile = path.resolve(__dirname, 'root-bot.js')
  const rootBotSource = fs.readFileSync(rootBotFile, 'utf8')
  botKernel.register(nick, rootBotSource)
}

export function send (message) {
  botKernel.send(message)
}

export default sesBot

