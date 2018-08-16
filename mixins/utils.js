import dedent from 'dedent'
import chalk from 'chalk'

export default function makeUtilsMixin() {
  return {
    chalk,
    dedent,
    sleep: delay => new Promise(resolve => {
      setTimeout(resolve, delay)
    })
  }
}
