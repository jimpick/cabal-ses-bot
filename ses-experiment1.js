import SES from 'ses'

const r = SES.makeSESRootRealm()

function buildCounterSrc () {
  let def;

  function Counter () {
    let count = 0;
    return def({
      incr: () => { return ++count; },
      decr: () => { return --count; },
      get: () => count
    });
  }

  return `${Counter}; Counter()`;
}

const counter = r.evaluate(buildCounterSrc())

counter.incr()
counter.incr()
counter.incr()
console.log(counter.get())
// console.log(counter.dump())

r.evaluate(`
  incr();
  incr();
  log(get());
`, {incr: counter.incr, get: counter.get, log: console.log})

r.evaluate(`
  decr();
  decr();
  log(get());
`, {decr: counter.decr, get: counter.get, log: console.log})

