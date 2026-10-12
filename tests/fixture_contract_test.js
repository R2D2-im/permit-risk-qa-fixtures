'use strict'

const fs = require('fs')
const assert = require('assert')

const app = fs.readFileSync('app.js', 'utf8')
const html = fs.readFileSync('index.html', 'utf8')

const handlers = new Set([...app.matchAll(/^\s{2}([A-Za-z0-9_]+): async/gm)].map(match => match[1]))
const buttons = new Set([...html.matchAll(/data-case="([A-Za-z0-9_]+)"/g)].map(match => match[1]))

assert.deepStrictEqual([...buttons].sort(), [...handlers].sort(), 'every DApp button must have exactly one handler')

const requiredRawFixtures = [
  "usdcPermit('0x1'",
  'permit2Single(1)',
  "permit2Batch('0', '0x1')",
  "permit2Batch('0', 1)",
  "usdcPermit('0x0'",
  'permit2Single(0)',
  "permit2Batch('0', '0x0')",
  "permit2Batch('0', 0)",
  '{ allowed: false }',
  '{ value: 0 }'
]

for (const fixture of requiredRawFixtures) {
  assert(app.includes(fixture), `missing raw security fixture: ${fixture}`)
}

assert(!app.includes('return { token, amount: amount.toString()'), 'Permit2 helper must not normalize raw amount encoding')
console.log(`validated ${buttons.size} DApp cases and ${requiredRawFixtures.length} raw security fixtures`)
