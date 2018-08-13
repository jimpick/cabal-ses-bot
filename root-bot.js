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
    commandMatch[2].trim().split(/\s+/) : null
  switch (command) {
    case 'register':
      {
        if (!args || args.length != 2 || !args[1].startsWith('dat://')) {
          await sendMessage(`Usage: register <bot-name> <dat://.. url>`)
          return
        }
        const [botName, url] = args
        const [err, pid] = await admin.register(botName, url)
        if (err) {
          await sendMessage(`Error registering bot: ${err}`)
          return
        }
        await sendMessage(`Bot registered at PID ${pid}`)
      }
      return
    case 'kill':
      {
        if (!args || args.length !== 1 || !(parseInt(args[0], 10) >= 0)) {
          await sendMessage(`Usage: kill <pid>`)
          return
        }
        const pid = parseInt(args[0], 10)
        if (pid === 0) {
          await sendMessage(`Cannot kill PID 0`)
          return
        }
        const err = admin.kill(pid)
        if (err) {
          await sendMessage(`Error killing PID ${pid}: ${err}`)
          return
        }
        await sendMessage(`Killed PID ${pid}`)
      }
      return
    case 'resurrect':
      {
        if (!args || args.length !== 1 || !(parseInt(args[0], 10) >= 0)) {
          await sendMessage(`Usage: resurrect <pid>`)
          return
        }
        const pid = parseInt(args[0], 10)
        const err = admin.resurrect(pid)
        if (err) {
          await sendMessage(`Error resurrecting PID ${pid}: ${err}`)
          return
        }
        await sendMessage(`Resurrected PID ${pid}`)
      }
      return
    case 'killall':
      const killedProcesses = admin.killall()
      if (killedProcesses.length === 0) {
        await sendMessage('No running processes to kill')
        return
      }
      await sendMessage(`Killed PIDs: ${killedProcesses.join(' ')}`)
      return
    case 'update':
      await sendMessage('Not implemented yet.')
      return
    case 'ps':
      const processes = await admin.ps()
      const lines = []
      processes.forEach((proc, pid) => {
        const {botName, killed} = proc
        lines.push(`PID: ${pid} ${killed ? '[terminated] ' : ''}${botName}`)
      })
      await sendMessage(lines.join('\n'))
      return
    case 'help':
      await sendMessage(dedent`
        Supported commands:

          * help
          * register <nick> <dat url>
          * ps
          * kill <pid>
          * killall
          * resurrect <pid>
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

