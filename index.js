#!/usr/bin/env node -r esm

import path from 'path'
import Cabal from 'cabal-node'
import cabalSwarm from 'cabal-node/swarm'
import ram from 'random-access-memory'
import minimist from 'minimist'
import mkdirp from 'mkdirp'
import sesBot, { send } from './ses-bot'

const argv = minimist(process.argv.slice(2))

if (!argv.key || !argv.dir || !argv.nick) {
  console.error(
    `Usage: ${path.basename(process.argv[1])} ` +
    `--key <key> --dir <dir> --nick <nick>`
  )
  process.exit(1)
}

mkdirp.sync(argv.dir)

console.log('Starting bot server...')
console.log('Key:', argv.key)
console.log('Dir:', path.resolve(argv.dir))
console.log('Nick:', argv.nick)

const cabal = Cabal(
  path.resolve(argv.dir, 'db'),
  argv.key,
  {username: argv.nick}
)
cabal.db.on('ready', function () {
  cabalSwarm(cabal)
  cabal.getChannels((err, channels) => {
    channels.forEach(joinChannel)
  })
})

function joinChannel (channel) {
  const stream = cabal.createReadStream(channel)
  stream.on('data', () => {})
  stream.on('end', () => {
    // console.log('End', channel)
    cabal.watch(channel, () => {
      cabal.getMessages(channel, 1, (err, messages) => {
        if (err) {
          console.log('Error', err)
          return
        }
        const data = messages[0]
        const message = {
          channel,
          author: data[0].value.author,
          time: data[0].value.time,
          content: data[0].value.content
        }
        onMessage(message)
      })
    })
  })
}

function onMessage (message) {
  const {channel, author, time, content} = message
  // console.log(`${channel} ${time} - ${author}: ${content}`)
  send(message)
}

sesBot.on('message', data => {
  // console.log('SesBot message', data)
  const {channel, message, options} = data 
  cabal.message(channel, message, options)
})
