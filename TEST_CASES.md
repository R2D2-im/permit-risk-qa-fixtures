# OPS-262 可执行测试用例

## 通用前置条件

1. 使用包含 OPS-262 修复的 imToken staging build，记录平台、App 版本和 build number。
2. 准备 Ethereum Mainnet 专用测试钱包；钱包需要少量 ETH 支付 gas。Permit 签名用例不要求持有代币。
3. 在 imToken DApp 浏览器打开测试页，点击“连接 imToken 内置钱包”。
4. 确认页面显示 `eip155:1 Ethereum Mainnet`，正常 EOA spender 为
   `0x4031e602f315e37ec17415740fd24605372911b6`。
5. 执行 N02，确认正常 spender 的 `isEOA=true`。
6. 从 QA 维护的数据源取得当前有效黑名单地址，填入“黑名单 spender”。记录 fixture 来源和有效时间；不要使用未经确认的地址替代。
7. 每个用例执行后保存 Preview 截图或录屏，并复制页面底部 JSON。除专门要求签名成功的检查外，可在完成 Preview 核对后取消签名。

## P01 ERC-2612 Permit 有限授权

1. spender 模式选择“正常 EOA spender”。
2. 点击 `P01 · 授权 1 USDC` 的“发起签名”。
3. 在钱包 Preview 核对 token=USDC、spender=默认地址、value=1 USDC、网络=Ethereum。
4. 核对出现 EOA 授权 warning 和风险确认流程。
5. 取消签名，返回 DApp 复制 JSON。
6. 切换为“黑名单 spender”并重复步骤 2–5。

预期：正常 EOA 返回并展示一次 `risk_info_approve_address_eoa`；黑名单场景同时展示 EOA warning 与 `address_is_block`，且黑名单风险阻止继续授权。两个风险不能互相替代。

## P02 ERC-2612 Permit 无限授权

1. 选择正常 EOA spender。
2. 点击 `P02 · 无限授权`。
3. 核对 spender、USDC 和 `uint256.max` 被展示为无限授权或等价高风险语义。
4. 核对 EOA warning 和风险确认；取消签名。
5. 使用黑名单 spender 重复。

预期：无限授权语义正确；正常 EOA 有 warning，黑名单额外阻断。

## P03 ERC-2612 Permit 撤销

1. 分别选择正常 EOA 与黑名单 spender。
2. 点击 `P03 · 撤销授权`。
3. 核对 value=0，Preview 表达“撤销/取消授权”。
4. 完成 Preview 检查后取消签名并保存证据。

预期：不得把 value=0 当作新增授权，不出现错误的 EOA 授权 warning；地址 fixture 仍应被正确解析和展示。

## P04 / P05 DAI-style Permit

1. 选择正常 EOA spender，点击 P04 `allowed=true`。
2. 核对 token=DAI、holder=当前账户、spender 正确，授权风险 warning 正常展示。
3. 换用黑名单 spender 重复，核对 `address_is_block` 阻断。
4. 分别对两个 spender 点击 P05 `allowed=false`。
5. 核对 P05 是撤销语义，不误报新增授权。

预期：`allowed=true` 与非零 Permit 一致；`allowed=false` 与 value=0 撤销一致。

## P06 Permit2 PermitSingle 有限授权

1. 选择正常 EOA spender。
2. 点击 `P06 · Single 1 USDC`。
3. 核对 verifying contract 为 canonical Permit2，details.token=USDC、amount=1 USDC、spender 与 expiration 正确。
4. 核对 EOA warning；取消签名。
5. 使用黑名单 spender 重复并核对额外阻断。

预期：Permit2 的嵌套 `details` 能正确提取 spender 和金额；风险表现与普通 Approve 一致。

## P07 / P08 Permit2 PermitSingle 最大授权与撤销

1. 对正常 EOA 和黑名单 spender 分别执行 P07。
2. 核对 `uint160.max` 的无限/超大授权语义、EOA warning 和黑名单阻断。
3. 对两种 spender 分别执行 P08。
4. 核对 amount=0 是撤销语义，不误报新增授权。

预期：P07 风险完整；P08 不产生授权误报。

## P09 Permit2 PermitBatch 混合金额

1. 选择正常 EOA spender，点击 `P09 · Batch 混合金额`。
2. 核对 details[0] 是 USDC amount=0；details[1] 是 DAI amount=1 DAI。
3. 核对授权风险绑定非零的第二项和页面所示 spender，不能因为第一项为 0 而漏判。
4. 使用黑名单 spender 重复，核对 EOA warning 与黑名单阻断同时存在。

预期：遍历整个 batch；不会只读取第一项，也不会把风险绑定到错误 token 或地址。

## P10 Permit2 PermitBatch 全量撤销

1. 对正常 EOA 和黑名单 spender 分别执行 P10。
2. 核对 USDC、DAI 两项 amount 都为 0。
3. 核对整体是撤销语义并保存证据。

预期：全部为 0 时不误报新增授权风险。

## N01 / N02 反向对照

1. 点击 N01，核对 primaryType=Mail 的普通 typed data。
2. 确认未进入 Approve Preview，未展示 EOA Approve 或黑名单授权风险。
3. 对正常 EOA 和黑名单 fixture 分别执行 N02，记录 `eth_getCode` 结果。

预期：N01 不误识别为 Permit；正常地址 `isEOA=true`。黑名单 fixture 是否为 EOA 必须按实际结果记录，不能预设。

## S01–S04 非零金额编码回归

对正常 EOA 和有效黑名单 spender 分别执行：

- S01：ERC-2612 `value: "0x1"`。
- S02：PermitSingle `details.amount: 1`，必须在复制的 JSON 中确认类型为 number。
- S03：PermitBatch amounts 为 `["0", "0x1"]`。
- S04：PermitBatch amounts 为 `["0", 1]`。

预期：四个场景都按非零授权处理。正常 EOA 出现 `risk_info_approve_address_eoa`；黑名单出现 `address_is_block` 且只能拒绝。S03/S04 的风险必须来自第二项，不能因第一项为零而漏判。

## S05–S08 不同编码的真实零值

对正常 EOA 和有效黑名单 spender 分别执行：

- S05：ERC-2612 `value: "0x0"`。
- S06：PermitSingle `details.amount: 0`（JSON number）。
- S07：PermitBatch amounts 为 `["0", "0x0"]`。
- S08：PermitBatch amounts 为 `["0", 0]`。

预期：均按撤销处理，不出现新增授权的 EOA warning。必须保留实际 typed data 证据，确认 App 没有在发送前改写原始类型。

## S09–S10 未声明字段干扰

1. S09 发送 ERC-2612 已声明非零 `value:"1"`，同时在 message 放入 schema 未声明的 `allowed:false`。
2. S10 发送 DAI 已声明 `allowed:true`，同时在 message 放入 schema 未声明的 `value:0`。
3. 两项均先执行正常 EOA，再执行有效黑名单 spender。

预期：未声明字段不能改变签名 schema 的语义。S09/S10 都必须保留授权风险；正常 EOA 可继续风险确认，黑名单只能拒绝。

说明：空值、缺失、负数、越界、不完整批次、重复或歧义 schema 可能在钱包 EIP-712 编码层先被拒绝，不能稳定到达 Preview，因此以 API/单测作为主验收；若 App 允许请求进入后端，则不得返回“撤销、无风险”的成功结果。

## A01–A04 SEC-002 无前缀非零授权

对正常 EOA 和有效黑名单 spender 分别执行。每次返回 DApp 后复制 JSON，确认 `request.message.spender` 是 40 位 hex 且没有 `0x` 前缀：

- A01：ERC-2612 `value:"1"`。
- A02：DAI `allowed:true`。
- A03：PermitSingle `amount:"1"`。
- A04：PermitBatch amounts 为 `["0","1"]`。

预期：原始 typed data 保持无前缀，不由 DApp 或 Preview 改写。普通 EOA 出现 `risk_info_approve_address_eoa` 且可继续风险确认；黑名单出现 EOA 与 `address_is_block` 两项风险，且只能拒绝。A04 必须识别第二项非零金额。

## A05–A08 SEC-002 无前缀真实撤销

对正常 EOA 和有效黑名单 spender 分别执行，并确认复制的 JSON 中 spender 仍无前缀：

- A05：ERC-2612 `value:"0"`。
- A06：DAI `allowed:false`。
- A07：PermitSingle `amount:"0"`。
- A08：PermitBatch amounts 为 `["0","0"]`。

预期：四项均按撤销处理，不出现 EOA 或黑名单新增授权风险。地址规范化只能用于风险查询，不能改变待签 payload 或把真实撤销变成授权。

## A09 SEC-002 非 Permit 反向对照

1. 对正常与黑名单 spender 分别执行 A09。
2. 确认 `primaryType=Order`、`Order.spender` 类型为 `address`，实际值为无前缀地址。
3. 检查 Preview 与风险详情。

预期：不得仅因字段名为 `spender` 或地址可规范化而进入 Permit / Approve 风险链路；不展示 EOA / blacklist 授权风险。

说明：短地址、超长地址、非 hex、空值、null、number、boolean、object、array，以及 spender 声明缺失、类型错误、重复或歧义等输入，可能由 App 的 EIP-712 编码层先拒绝，以 API/单测作为主验收。它们不得被补零或截断为另一个有效地址，也不得被判定为无风险撤销。

## T01 / T02 / T03 普通 Approve 对照（可选、真实交易）

1. 仅在测试钱包有 ETH 且允许发真实 Mainnet 交易时展开“链上操作”。
2. T01 选择正常 EOA，点击生成交易，通过浏览器二次确认，在钱包 Preview 核对普通 Approve 仍有 EOA warning。无需链上状态时可在钱包取消。
3. 黑名单场景只需检查 Preview 和阻断，不应绕过阻断广播。
4. 如 T01 已广播成功，执行 T03，确认 allowance=1,000,000。
5. 执行 T02 approve(0)，等待成功后再次执行 T03，确认 allowance=0。

预期：原有普通 Approve 风险能力不回退；撤销后 allowance 归零。任何签名取消都不得产生交易 hash 或链上状态变化。

## 通过标准

- P01、P02、P04、P06、P07、P09 的正常 EOA 和黑名单矩阵全部符合风险预期。
- P03、P05、P08、P10 撤销矩阵无授权误报。
- S01–S04、S09–S10 的正常 EOA / 黑名单矩阵保留授权提醒与阻断。
- S05–S08 的不同零值编码均为撤销语义，无新增授权误报。
- A01–A04 的无前缀非零 spender 均保留 EOA 提醒与黑名单阻断。
- A05–A08 的无前缀撤销均无新增授权误报；A09 不误入授权风险链路。
- N01 不误判，N02 证明正常 fixture 确为 EOA。
- 地址、token、amount、chain、risk message 均与请求一致，无串用或重复风险。
- API 回归通过不能代替以上 App Preview、确认和阻断验收。
