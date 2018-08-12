import SES from 'ses'
import debug from 'debug'

const debugLog = debug('ses-bot')

const r = SES.makeSESRootRealm()

function buildBotKernelSrc () {
  let def, log

  function kernel () {
    let pidCounter = 0
    let messageCounter = 0
    let handlers = []
    let state = []
    return def({
      register: handlerFunc => {
        const pid = ++pidCounter
        handlers[pid] = {
          handlerFunc
        }
        log('Registered handler at PID:', pid, handlerFunc)
        return pid
      },
      send: message => {
        const id = 'm' + ++messageCounter
        log(id, `Message:`, message)
        const results = handlers.map((handler, pid) => {
          const {handlerFunc, killed} = handler
          if (killed) return
          function handlerLog () {
            log(`${id} PID ${pid}`, ...arguments)
          }
          try {
            handlerLog('State:', state[pid])
            const result = SES.confine(
              `(${handlerFunc})(message, state)`,
              {
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
            handlerLog('Fail:', e)
            return {
              error: {
                name: e.name,
                message: e.message,
                code: e.code,
                stack: e.stack
              }
            }
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
  log: debug,
  emit
})

function emit (message) {
  console.log('Emit:', message)
}

function bot1 (message, state) {
  if (!state) state = {counter: 0}
  let {counter} = state
  counter++
  emit(`Bot 1 replying to ${message} - ${counter}`)
  // log('Hiya', state)
  setState({counter})
  return counter
}
botKernel.register(bot1)

let results
results = botKernel.send('testMessage1')
results = botKernel.send('testMessage2')

function bot2 (message, state) {
  if (!state) state = {counter: 0}
  let {counter} = state
  counter++
  emit(`Bot 2 replying to ${message} - ${counter}`)
  // log('Hiya', state)
  setState({counter})
  return counter
}
botKernel.register(bot2)

botKernel.send('testMessage3')
botKernel.send('testMessage4')
console.log(botKernel.ps())
botKernel.kill(2)
console.log(botKernel.ps())
botKernel.send('testMessage5')


