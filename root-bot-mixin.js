import path from 'path'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import parseDatUrl from 'parse-dat-url'
import {createNode} from '@beaker/dat-node'

export default function makeRootBotMixin ({
  processes,
  debugLog,
  storageDir,
  register,
  updateHandlerFunc,
  updateKilled
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
          await register(botName, js, {url})
          return [null, pid]
        } catch (e) {
          debugLog('Error', e)
          return [e, null]
        }
      },
      kill: async pid => {
        if (!processes[pid]) {
          return new Error('Process does not exist')
        }
        debugLog('Killed', pid)
        await updateKilled(pid, true)
      },
      resurrect: async pid => {
        if (!processes[pid]) {
          return new Error('Process does not exist')
        }
        if (!processes[pid].killed) {
          return new Error('Process was not terminated')
        }
        debugLog('Resurrected', pid)
        await updateKilled(pid, false)
      },
      killall: async () => {
        const killedProcesses = []
        for (let pid in processes) {
          if (pid === '0') continue
          const process = processes[pid]
          if (!process.killed) {
            await updateKilled(pid, true)
            killedProcesses.push(pid)
          }
        }
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
          const url = processes[pid].metadata.url
          const {host, pathname} = parseDatUrl(url)
          const archive = await dat.getArchive(host)
          const js = await archive.readFile(pathname, 'utf8')
          await dat.close()
          await updateHandlerFunc(pid, js)
          await updateKilled(pid, false)
          debugLog('Updated', pid, js)
        } catch (e) {
          debugLog('Error', e)
          return e
        }
      }
    }
  }
}

