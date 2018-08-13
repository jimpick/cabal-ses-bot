#!/usr/bin/env node -r esm

import path from 'path'
import Cabal from 'cabal-node'
import cabalSwarm from 'cabal-node/swarm'
import ram from 'random-access-memory'
import minimist from 'minimist'
import mkdirp from 'mkdirp'
import sesBot, { send, registerRootBot } from './ses-bot'

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
console.log('Nick:', argv.nick, '\n')

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
    cabal.metadata(channel, (err, metadata) => {
      if (err) {
        console.log('Error', err)
        return
      }
      watchForMessages(channel, metadata.latest)
    })
  })
}

function watchForMessages (channel, fromMessage) {
  let oldLatest = fromMessage
  let inProgress = false
  let pending = false
  cabal.watch(channel, () => {
    if (inProgress) {
      pending = true
      return
    }
    getMessages()

    function getMessages () {
      inProgress = true
      cabal.metadata(channel, (err, metadata) => {
        if (err) {
          console.log('Error', err)
          inProgress = false
          return
        }
        const wantMessages = metadata.latest - oldLatest
        // FIXME: Potentially a bit of a race here. Fetch a few
        // extra messages and filter them
        cabal.getMessages(channel, wantMessages + 3, (err, messages) => {
          if (err) {
            console.log('Error', err)
            inProgress = false
            return
          }
          if (!messages || messages.length === 0) return done()
          const newMessages = []
          messages.forEach(data => {
            //if (!data || data.length === 0) return done()
            if (!data || data.length === 0) return
            const match = data[0].key.match(/^messages\/.*\/(\d+)$/)
            if (!match || Number(match[1]) <= oldLatest) return
            newMessages.push({
              channel,
              author: data[0].value.author,
              time: data[0].value.time,
              content: data[0].value.content
            })
          })
          oldLatest = metadata.latest
          pushMessages(done)

          function pushMessages (cb) {
            const message = newMessages.pop()
            if (!message) return cb()
            onMessage(message, err => {
              if (err) return cb(err)
              pushMessages(cb)
            })
          }

          function done (err) {
            if (err) console.error('Error', err)
            inProgress = false
            if (pending) {
              pending = false
              getMessages()
            }
          }
        })
      })
    }
  })
}

function onMessage (message, cb) {
  const {channel, author, time, content} = message
  // console.log(`${channel} ${time} - ${author}: ${content}`)
  send(message, cb)
}

sesBot.on('message', data => {
  // console.log('SesBot message', data)
  const {channel, message, options} = data 
  cabal.message(channel, message, options)
})

registerRootBot(argv.nick, argv.dir)

