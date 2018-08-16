import fs from 'fs'
import path from 'path'
import util from 'util'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import parseDatUrl from 'parse-dat-url'
import {createNode} from '@beaker/dat-node'

const writeFile = util.promisify(fs.writeFile)

export default function makeRootBotMixin ({
  processes,
  debugLog,
  storageDir,
  register
}) {
  return {
    admin: {
      ps: () => processes,
      register: async (botName, url) => {
        // FIXME: Only one at a time
        debugLog('Register', botName, url)
        const pid = processes.length
        try {
          const botDir = path.join(storageDir, 'bots', `${pid}`)
          rimraf.sync(botDir)
          mkdirp.sync(botDir)
          debugLog('Dir', botDir)
          const sourceDatDir = path.join(botDir, 'sourceDat')
          const dat = createNode({path: sourceDatDir})
          const {host, pathname} = parseDatUrl(url)
          const archive = await dat.getArchive(host)
          const js = await archive.readFile(pathname, 'utf8')
          await dat.close()
          await register(botName, js)
          processes[pid].url = url
          const botJsonFile = path.join(botDir, 'bot.json')
          const botJson = JSON.stringify({url}, null, 2)
          await writeFile(botJsonFile, botJson)
          return [null, pid]
        } catch (e) {
          debugLog('Error', e)
          return [e, null]
        }
      },
      kill: pid => {
        if (!processes[pid]) {
          return new Error('Process does not exist')
        }
        debugLog('Killed', pid)
        processes[pid].killed = true
      },
      resurrect: pid => {
        if (!processes[pid]) {
          return new Error('Process does not exist')
        }
        if (!processes[pid].killed) {
          return new Error('Process was not terminated')
        }
        debugLog('Resurrected', pid)
        processes[pid].killed = false
      },
      killall: () => {
        const killedProcesses = []
        processes.forEach((process, pid) => {
          if (pid === 0) return
          if (!process.killed) {
            process.killed = true
            killedProcesses.push(pid)
          }
        })
        debugLog('Killed', killedProcesses)
        return killedProcesses
      },
      update: async pid => {
        if (!processes[pid]) {
          return new Error('Process does not exist')
        }
        try {
          const botDir = path.join(storageDir, 'bots', `${pid}`)
          const sourceDatDir = path.join(botDir, 'sourceDat')
          rimraf.sync(botDir)
          mkdirp.sync(botDir)
          debugLog('Dir', botDir)
          const dat = createNode({path: sourceDatDir})
          const url = processes[pid].url
          const {host, pathname} = parseDatUrl(url)
          const archive = await dat.getArchive(host)
          const js = await archive.readFile(pathname, 'utf8')
          await dat.close()
          processes[pid].handlerFunc = js
          processes[pid].killed = false
          debugLog('Updated', pid, js)
        } catch (e) {
          debugLog('Error', e)
          return e
        }
      }
    }
  }
}

