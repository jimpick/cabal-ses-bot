module.exports = handleMessage

async function handleMessage (botName, message, state) {
  const {channel, content, author} = message
  const regex = new RegExp(`^${botName}[ :] *(.*)$`)
  const botMatch = content.match(regex)
  if (!botMatch) return
  let command = botMatch[1].trim()

  console.log(`Received "${command}" from ${author}`)
  const commandMatch = command.match(/^(\w+)(\s+.*)?$/)
  if (!commandMatch) return await unrecognized()
  command = commandMatch[1]
  const args = commandMatch.length > 1 && commandMatch[2] ?
    commandMatch[2].trim().split() : null
  console.log('Jim command', command)
  switch (command) {
    case 'register':
    case 'ps':
    case 'kill':
    case 'killall':
      await sendMessage('Not implemented yet.')
      return
    case 'help':
      await sendMessage(dedent`
        Supported commands:

          * help
          * register <nick> <dat url>
          * ps <pid>
          * kill <pid>
          * killall
          * update <pid>
      `)
      return
    default:
      return await unrecognized()
  }

  async function unrecognized () {
    await sendMessage('Unrecognized command. Need help? Send the command "help"')
  }

  async function sendMessage (message) {
    const lines = message.split('\n')
    for (let line of lines) {
      if (line === '') line = ' '
      // FIXME: Can it work without delay?
      chat.send({channel, message: line})
      await sleep(250)
    }
  }
}

