# Permit / Permit2 Risk QA Fixtures

Static test DApp for [consenlabs/ops#262](https://github.com/consenlabs/ops/issues/262).

It generates Ethereum Mainnet EIP-712 requests for:

- ERC-2612 USDC Permit: finite, maximum, and zero-value revoke
- DAI-style Permit: `allowed=true` and `allowed=false`
- Permit2 `PermitSingle`: finite, maximum, and zero-value revoke
- Permit2 `PermitBatch`: first item zero / second non-zero, and all-zero revoke
- security regression encodings: hex integers, JSON numbers, mixed batch
  representations, and mixed zero representations
- undeclared-field interference controls for ERC-2612 and DAI-style Permit
- non-Permit typed-data negative control
- standard USDC `approve` / revoke transaction controls and allowance reads

All Permit cases only request a signature. They do not submit the signature or
change on-chain allowance. Standard `approve` controls are real Ethereum Mainnet
transactions and require an extra browser confirmation before the wallet prompt.

## Run locally

```sh
python3 -m http.server 8080 --directory /Users/r2d2/clawd/manual-test/permit-risk-qa
```

Open `http://<reachable-host>:8080` in the imToken DApp browser.

## Validate fixture wiring

```sh
node --check app.js
node tests/fixture_contract_test.js
```

## Fixed contracts

- Ethereum Mainnet: `eip155:1`
- USDC: `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- DAI: `0x6B175474E89094C44Da98b954EedeAC495271d0F`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- default normal EOA spender: `0x4031e602f315e37ec17415740fd24605372911b6`

The blocked/high-risk spender is deliberately not committed. QA must enter a
currently valid risk fixture and record its provenance with the test evidence.

## Acceptance expectations

- non-zero Permit/Permit2 to a normal EOA: `risk_info_approve_address_eoa` warning
- non-zero Permit/Permit2 to a blocked address: EOA warning plus
  `address_is_block`, with the blocked-address flow preventing authorization
- zero-value or `allowed=false` revoke: revoke semantics without a false new-
  authorization warning
- non-Permit typed data: no Approve risk classification
- Batch mixed amount: risk binds to the non-zero detail, not only the first item
- raw JSON type is preserved in S01–S10; verify copied evidence rather than only
  the wallet's formatted token amount

Record the App version/build, OS, device, spender mode/address provenance,
screenshots or recording, copied JSON evidence, and actual result for every case.
