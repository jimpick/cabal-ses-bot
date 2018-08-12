module.exports = handleMessage

function handleMessage (botName, message, state) {
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

