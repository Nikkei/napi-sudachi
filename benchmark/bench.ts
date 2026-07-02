import { createRequire } from 'node:module'
import { Bench } from 'tinybench'

const require = createRequire(import.meta.url)

const sudachi = require('../wrapper.js') as typeof import('../index.js')

const tokenizer = new sudachi.Tokenizer()
const text = 'すもももももももものうち'
const mode = sudachi.SplitMode.c()

const b = new Bench()

b.add('tokenizer.tokenize', () => {
  tokenizer.tokenize(text, mode)
})

await b.run()

console.table(b.table())
