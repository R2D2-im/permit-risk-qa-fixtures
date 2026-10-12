'use strict'

const CHAIN_ID = 1
const CHAIN_HEX = '0x1'
const DEFAULT_SPENDER = '0x4031e602f315e37ec17415740fd24605372911b6'
// Keep contract addresses lowercase when sending transactions. A mixed-case
// address with an invalid EIP-55 checksum is rejected by imToken before preview.
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const ONE_USDC = 1_000_000n
const ONE_DAI = 1_000_000_000_000_000_000n
const MAX160 = (1n << 160n) - 1n
const MAX256 = (1n << 256n) - 1n
const SELECTOR = { nonces: '0x7ecebe00', permit2Allowance: '0x927da105', approve: '0x095ea7b3', allowance: '0xdd62ed3e' }

let account = null
let lastEvidence = null
const $ = id => document.getElementById(id)

function provider() {
  if (!window.ethereum) throw new Error('未检测到钱包 provider，请在 imToken DApp 浏览器中打开')
  return window.ethereum
}

function validAddress(value) { return /^(?:0x)?[0-9a-fA-F]{40}$/i.test(value) }
function prefixedAddress(value) { return `0x${value.replace(/^0x/i, '')}` }
function word(value) { return value.toString().replace(/^0x/, '').toLowerCase().padStart(64, '0') }
function addressWord(value) { return word(value) }
function uintWord(value) { return word(`0x${BigInt(value).toString(16)}`) }
function callData(selector, words) { return selector + words.join('') }
function nowPlus(seconds = 3600) { return Math.floor(Date.now() / 1000) + seconds }

function selectedSpender() {
  const mode = $('spenderMode').value
  const id = mode === 'risk' ? 'riskSpender' : 'spender'
  const value = $(id).value.trim()
  if (!validAddress(value)) throw new Error(`${mode === 'risk' ? '黑名单' : '正常'} spender 地址无效`)
  return prefixedAddress(value)
}

function unprefixedSpender() {
  return selectedSpender().replace(/^0x/i, '')
}

function evidence(kind, caseId, request, response) {
  lastEvidence = {
    timestamp: new Date().toISOString(),
    caseId,
    kind,
    chainId: `eip155:${CHAIN_ID}`,
    account,
    spenderMode: $('spenderMode').value,
    spender: (() => { try { return selectedSpender() } catch { return null } })(),
    request,
    response
  }
  $('output').textContent = JSON.stringify(lastEvidence, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2)
}

async function refresh() {
  const chain = await provider().request({ method: 'eth_chainId' })
  const accounts = await provider().request({ method: 'eth_accounts' })
  account = accounts[0] || null
  $('account').textContent = account || '未连接'
  $('chain').textContent = chain === CHAIN_HEX ? 'eip155:1 Ethereum Mainnet' : `${chain}（错误网络）`
  $('chain').className = chain === CHAIN_HEX ? 'ok' : 'error'
  $('switch').disabled = !account || chain === CHAIN_HEX
  $('refresh').disabled = !account
  document.querySelectorAll('[data-case]').forEach(button => { button.disabled = !account || chain !== CHAIN_HEX })
  $('status').className = account && chain === CHAIN_HEX ? 'ok' : 'warn'
  $('status').textContent = account && chain === CHAIN_HEX ? '已连接。签名用例不会广播；仍请逐项核对钱包 Preview。' : '请连接专用测试钱包并切换到 Ethereum Mainnet。'
}

async function ethCall(to, data) {
  return provider().request({ method: 'eth_call', params: [{ to, data }, 'latest'] })
}

async function nonceOf(token) {
  const raw = await ethCall(token, callData(SELECTOR.nonces, [addressWord(account)]))
  return BigInt(raw)
}

async function permit2NonceOf(token, spender) {
  const raw = await ethCall(PERMIT2, callData(SELECTOR.permit2Allowance, [addressWord(account), addressWord(token), addressWord(spender)]))
  if (raw.length < 194) throw new Error('Permit2 allowance 返回格式异常')
  return BigInt(`0x${raw.slice(-64)}`)
}

async function signTyped(caseId, typedData) {
  evidence('typed-data-request', caseId, typedData, '等待钱包处理')
  try {
    const signature = await provider().request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(typedData)] })
    evidence('typed-data-signed', caseId, typedData, { signature })
  } catch (error) {
    evidence('typed-data-rejected', caseId, typedData, { code: error.code ?? null, message: error.message || String(error) })
    if (error.code !== 4001) throw error
  }
}

function usdcPermit(value, nonce, extraMessage = {}, spender = selectedSpender()) {
  return {
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
      Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }]
    },
    primaryType: 'Permit',
    domain: { name: 'USD Coin', version: '2', chainId: CHAIN_ID, verifyingContract: USDC },
    message: { owner: account, spender, value, nonce: nonce.toString(), deadline: nowPlus().toString(), ...extraMessage }
  }
}

function daiPermit(allowed, nonce, extraMessage = {}, spender = selectedSpender()) {
  return {
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
      Permit: [{ name: 'holder', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'expiry', type: 'uint256' }, { name: 'allowed', type: 'bool' }]
    },
    primaryType: 'Permit',
    domain: { name: 'Dai Stablecoin', version: '1', chainId: CHAIN_ID, verifyingContract: DAI },
    message: { holder: account, spender, nonce: nonce.toString(), expiry: nowPlus().toString(), allowed, ...extraMessage }
  }
}

function permitDetails(token, amount, nonce, expiration) {
  return { token, amount, expiration: expiration.toString(), nonce: nonce.toString() }
}

function permit2Types(primaryType) {
  const types = {
    EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
    PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }]
  }
  types[primaryType] = primaryType === 'PermitSingle'
    ? [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }]
    : [{ name: 'details', type: 'PermitDetails[]' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }]
  return types
}

async function permit2Single(amount, spender = selectedSpender()) {
  const expiry = nowPlus()
  return {
    types: permit2Types('PermitSingle'), primaryType: 'PermitSingle',
    domain: { name: 'Permit2', chainId: CHAIN_ID, verifyingContract: PERMIT2 },
    message: { details: permitDetails(USDC, amount, await permit2NonceOf(USDC, spender), expiry), spender, sigDeadline: expiry.toString() }
  }
}

async function permit2Batch(firstAmount, secondAmount, spender = selectedSpender()) {
  const expiry = nowPlus()
  const [usdcNonce, daiNonce] = await Promise.all([permit2NonceOf(USDC, spender), permit2NonceOf(DAI, spender)])
  return {
    types: permit2Types('PermitBatch'), primaryType: 'PermitBatch',
    domain: { name: 'Permit2', chainId: CHAIN_ID, verifyingContract: PERMIT2 },
    message: {
      details: [permitDetails(USDC, firstAmount, usdcNonce, expiry), permitDetails(DAI, secondAmount, daiNonce, expiry)],
      spender, sigDeadline: expiry.toString()
    }
  }
}

function plainTypedData() {
  return {
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }],
      Mail: [{ name: 'from', type: 'address' }, { name: 'contents', type: 'string' }]
    },
    primaryType: 'Mail', domain: { name: 'OPS-262 Negative Control', version: '1', chainId: CHAIN_ID },
    message: { from: account, contents: 'This is not a Permit or approval.' }
  }
}

function plainSpenderTypedData() {
  return {
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }],
      Order: [{ name: 'spender', type: 'address' }, { name: 'contents', type: 'string' }]
    },
    primaryType: 'Order', domain: { name: 'SEC-002 Negative Control', chainId: CHAIN_ID },
    message: { spender: unprefixedSpender(), contents: 'This is not a Permit or approval.' }
  }
}

async function sendApprove(caseId, amount) {
  const spender = selectedSpender()
  const request = { from: account, to: USDC, value: '0x0', data: callData(SELECTOR.approve, [addressWord(spender), uintWord(amount)]) }
  const warning = `即将生成真实 Ethereum Mainnet 交易：${caseId}\nspender: ${spender}\namount(raw): ${amount}\n\n继续后仍需在钱包确认。`
  if (!window.confirm(warning)) { evidence('transaction-cancelled', caseId, request, '浏览器二次确认已取消'); return }
  evidence('transaction-request', caseId, request, '等待钱包确认')
  const txHash = await provider().request({ method: 'eth_sendTransaction', params: [request] })
  evidence('transaction-submitted', caseId, request, { txHash })
}

const cases = {
  usdcPermitOne: async () => signTyped('P01-usdc-permit-one', usdcPermit(ONE_USDC.toString(), await nonceOf(USDC))),
  usdcPermitMax: async () => signTyped('P02-usdc-permit-max', usdcPermit(MAX256.toString(), await nonceOf(USDC))),
  usdcPermitZero: async () => signTyped('P03-usdc-permit-zero', usdcPermit('0', await nonceOf(USDC))),
  daiPermitAllow: async () => signTyped('P04-dai-permit-allow', daiPermit(true, await nonceOf(DAI))),
  daiPermitDeny: async () => signTyped('P05-dai-permit-deny', daiPermit(false, await nonceOf(DAI))),
  permit2SingleOne: async () => signTyped('P06-permit2-single-one', await permit2Single(ONE_USDC.toString())),
  permit2SingleMax: async () => signTyped('P07-permit2-single-max', await permit2Single(MAX160.toString())),
  permit2SingleZero: async () => signTyped('P08-permit2-single-zero', await permit2Single('0')),
  permit2BatchMixed: async () => signTyped('P09-permit2-batch-mixed', await permit2Batch('0', ONE_DAI.toString())),
  permit2BatchZero: async () => signTyped('P10-permit2-batch-zero', await permit2Batch('0', '0')),
  erc2612HexOne: async () => signTyped('S01-erc2612-hex-one', usdcPermit('0x1', await nonceOf(USDC))),
  permit2SingleNumberOne: async () => signTyped('S02-permit2-single-number-one', await permit2Single(1)),
  permit2BatchStringHex: async () => signTyped('S03-permit2-batch-string-hex', await permit2Batch('0', '0x1')),
  permit2BatchStringNumber: async () => signTyped('S04-permit2-batch-string-number', await permit2Batch('0', 1)),
  erc2612HexZero: async () => signTyped('S05-erc2612-hex-zero', usdcPermit('0x0', await nonceOf(USDC))),
  permit2SingleNumberZero: async () => signTyped('S06-permit2-single-number-zero', await permit2Single(0)),
  permit2BatchStringHexZero: async () => signTyped('S07-permit2-batch-string-hex-zero', await permit2Batch('0', '0x0')),
  permit2BatchStringNumberZero: async () => signTyped('S08-permit2-batch-string-number-zero', await permit2Batch('0', 0)),
  erc2612UndeclaredAllowed: async () => signTyped('S09-erc2612-undeclared-allowed-false', usdcPermit('1', await nonceOf(USDC), { allowed: false })),
  daiUndeclaredValue: async () => signTyped('S10-dai-undeclared-value-zero', daiPermit(true, await nonceOf(DAI), { value: 0 })),
  erc2612UnprefixedApprove: async () => signTyped('A01-erc2612-unprefixed-approve', usdcPermit('1', await nonceOf(USDC), {}, unprefixedSpender())),
  daiUnprefixedApprove: async () => signTyped('A02-dai-unprefixed-approve', daiPermit(true, await nonceOf(DAI), {}, unprefixedSpender())),
  permit2SingleUnprefixedApprove: async () => signTyped('A03-permit2-single-unprefixed-approve', await permit2Single('1', unprefixedSpender())),
  permit2BatchUnprefixedApprove: async () => signTyped('A04-permit2-batch-unprefixed-approve', await permit2Batch('0', '1', unprefixedSpender())),
  erc2612UnprefixedRevoke: async () => signTyped('A05-erc2612-unprefixed-revoke', usdcPermit('0', await nonceOf(USDC), {}, unprefixedSpender())),
  daiUnprefixedRevoke: async () => signTyped('A06-dai-unprefixed-revoke', daiPermit(false, await nonceOf(DAI), {}, unprefixedSpender())),
  permit2SingleUnprefixedRevoke: async () => signTyped('A07-permit2-single-unprefixed-revoke', await permit2Single('0', unprefixedSpender())),
  permit2BatchUnprefixedRevoke: async () => signTyped('A08-permit2-batch-unprefixed-revoke', await permit2Batch('0', '0', unprefixedSpender())),
  nonPermitUnprefixedSpender: async () => signTyped('A09-non-permit-unprefixed-spender', plainSpenderTypedData()),
  plainTypedData: async () => signTyped('N01-non-permit-typed-data', plainTypedData()),
  checkSpender: async () => {
    const spender = selectedSpender()
    const code = await provider().request({ method: 'eth_getCode', params: [spender, 'latest'] })
    evidence('read-only', 'N02-check-spender-code', { address: spender }, { code, isEOA: code === '0x' || code === '0x0' })
  },
  approveOne: async () => sendApprove('T01-usdc-approve-one', ONE_USDC),
  approveZero: async () => sendApprove('T02-usdc-approve-zero', 0n),
  readAllowance: async () => {
    const spender = selectedSpender()
    const data = callData(SELECTOR.allowance, [addressWord(account), addressWord(spender)])
    const raw = await ethCall(USDC, data)
    evidence('read-only', 'T03-read-usdc-allowance', { owner: account, spender, to: USDC, data }, { raw, amountRaw: BigInt(raw).toString() })
  }
}

$('usdc').textContent = USDC
$('daiAddress').textContent = DAI
$('permit2Address').textContent = PERMIT2
$('spender').value = DEFAULT_SPENDER
document.querySelectorAll('[data-case]').forEach(button => { button.disabled = true })

$('connect').onclick = async () => {
  try { await provider().request({ method: 'eth_requestAccounts' }); await refresh() }
  catch (error) { $('status').className = 'error'; $('status').textContent = error.message || String(error) }
}
$('switch').onclick = async () => {
  try { await provider().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); await refresh() }
  catch (error) { $('status').className = 'error'; $('status').textContent = `切换失败：${error.message || String(error)}` }
}
$('refresh').onclick = () => refresh().catch(error => { $('status').textContent = error.message || String(error) })
document.querySelectorAll('[data-case]').forEach(button => {
  button.onclick = async () => {
    try { button.disabled = true; await cases[button.dataset.case]() }
    catch (error) { evidence('error', button.dataset.case, null, { code: error.code ?? null, message: error.message || String(error) }) }
    finally { await refresh().catch(() => {}) }
  }
})
$('copy').onclick = async () => { await navigator.clipboard.writeText($('output').textContent); $('copy').textContent = '已复制'; setTimeout(() => { $('copy').textContent = '复制 JSON' }, 1200) }
$('clear').onclick = () => { lastEvidence = null; $('output').textContent = '尚未执行用例' }
if (window.ethereum) {
  window.ethereum.on?.('accountsChanged', () => refresh().catch(() => {}))
  window.ethereum.on?.('chainChanged', () => refresh().catch(() => {}))
}
