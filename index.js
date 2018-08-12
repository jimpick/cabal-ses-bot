import SES from 'ses'
import Cabal from 'cabal-node'
import cabalSwarm from 'cabal-node/swarm'
import ram from 'random-access-memory'
import sesBot, { send } from './ses-bot'

const key = '062cdf507da82626175a0b8db0a6b235b9c2134b96d2376fc8ef59a9597f32a1'

const cabal = Cabal(ram, key, {username: 'ses-bot'})
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
