module.exports = handleMessage

async function handleMessage (botName, message, state, refs) {
  const {channel, content, author} = message
  const regex = new RegExp(`^${botName}[ :] *(.*)$`)
  const match = content.match(regex)
  if (!match) return
  console.log(`Message: (${channel}) ${author}: "${content}"`)
  const rest = match[1]
  chat.send({
    channel,
    message: `${author}: Echo "${rest}"`
  })
}

