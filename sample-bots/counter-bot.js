module.exports = handleMessage

async function handleMessage (botName, message, state, refs) {
  if (!state) state = {counter: 0}
  let {counter} = state
  const {channel, content, author} = message
  const regex = new RegExp(`^${botName}([ :] *(.*))?$`)
  const match = content.match(regex)
  if (!match) return
  console.log(`Message: (${channel}) ${author}: "${content}"`)
  const command = match[2] ? match[2].trim().toLowerCase() : null
  if (command === 'incr') {
    counter++
    chat.send({
      channel,
      message: `Incremented => ${counter}`
    })
  } else if (command === 'decr') {
    counter--
    chat.send({
      channel,
      message: `Decremented => ${counter}`
    })
  } else {
    chat.send({
      channel,
      message: `Supported commands: "incr", "decr"`
    })
  }
  setState({counter})
}

