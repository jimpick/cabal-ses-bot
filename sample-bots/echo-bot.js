module.exports = handleMessage

async function handleMessage (botName, message, state) {
  const {channel, content, author} = message
  console.log(message)
  const regex = new RegExp(`^${botName}[ :] *(.*)$`)
  const match = content.match(regex)
  if (!match) return
  const rest = match[1]
  chat.send({
    channel,
    message: `${author}: Echo "${rest}"`
  })
}

