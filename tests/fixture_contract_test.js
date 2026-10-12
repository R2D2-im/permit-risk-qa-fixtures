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

const requiredUnprefixedFixtures = [
  'A01-erc2612-unprefixed-approve',
  'A02-dai-unprefixed-approve',
  'A03-permit2-single-unprefixed-approve',
  'A04-permit2-batch-unprefixed-approve',
  'A05-erc2612-unprefixed-revoke',
  'A06-dai-unprefixed-revoke',
  'A07-permit2-single-unprefixed-revoke',
  'A08-permit2-batch-unprefixed-revoke',
  'A09-non-permit-unprefixed-spender'
]

for (const fixture of requiredRawFixtures) {
  assert(app.includes(fixture), `missing raw security fixture: ${fixture}`)
}

for (const fixture of requiredUnprefixedFixtures) {
  assert(app.includes(fixture), `missing unprefixed spender fixture: ${fixture}`)
}

assert(!app.includes('return { token, amount: amount.toString()'), 'Permit2 helper must not normalize raw amount encoding')
assert(app.includes("replace(/^0x/i, '')"), 'SEC-002 fixtures must remove exactly one optional 0x prefix')
assert(app.includes('/^(?:0x)?[0-9a-fA-F]{40}$/i'), 'spender input must accept valid prefixed and unprefixed addresses')
assert(app.includes("return prefixedAddress(value)"), 'shared controls must canonicalize accepted input before use')
console.log(`validated ${buttons.size} DApp cases, ${requiredRawFixtures.length} raw amount fixtures, and ${requiredUnprefixedFixtures.length} unprefixed spender fixtures`)
