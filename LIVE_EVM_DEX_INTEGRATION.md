# Live External EVM DEX Integration

AtlasX now supports a non-custodial **Live external pools** mode that is separate from the existing **AtlasX internal AMM** (`/api/dex/*`). Internal pools remain simulated/internal and are not represented as live Uniswap pools.

## API Surface

Authenticated live endpoints:

- `GET /api/dex/live/networks` — protocol/chain support matrix from configured registry
- `GET /api/dex/live/pools` — pool discovery by chain/protocol/token pair or pool address
- `POST /api/dex/live/quote` — quote preview (estimate only)
- `POST /api/dex/live/prepare/swap` — unsigned wallet tx request for swap
- `POST /api/dex/live/prepare/liquidity/add` — unsigned wallet tx request
- `POST /api/dex/live/prepare/liquidity/remove` — unsigned wallet tx request

All transaction APIs are non-custodial and return wallet transaction requests (`to`, `data`, `value`, `chainId`, `from`) for EIP-1193 wallets to sign.

## Network Coverage Meaning

"All networks" means all **configured EVM chains in the registry with verified deployment addresses and RPC configured**, not all blockchains and not non-EVM chains.

Registered chains include Ethereum, Sepolia, BSC, BSC Testnet, Polygon, Base, and Arbitrum. Unsupported chain/protocol pairs return `UNSUPPORTED_PROTOCOL_ON_CHAIN`.

## Implemented vs Unsupported (current default configuration)

Implemented from verified default configuration:

- **Ethereum mainnet (chainId 1) + Uniswap V2**
- **Ethereum mainnet (chainId 1) + Uniswap V3**

Deliberately unsupported pending configuration/deployments:

- Uniswap V2/V3 on other registered chains without verified deployment overrides
- Uniswap V4 on all chains unless PoolManager + periphery/router support is fully configured
- PancakeSwap Infinity adapter on all chains unless official Infinity deployment/periphery is configured

## Protocol Operation Scope

- **Uniswap V2**: pair discovery, reserve/state read, quote estimation, swap/add/remove tx calldata prep
- **Uniswap V3**: pool discovery by fee tier, pool state read, quote estimation via quoter, swap and position-liquidity tx calldata prep
- **Uniswap V4**: adapter present but intentionally blocked unless fully configured with verified deployment/periphery
- **PancakeSwap Infinity**: separate adapter label (not represented as Uniswap), blocked unless fully configured

## Configuration

Use `.env.example` keys:

- RPC: `ETH_RPC_URL`, `BSC_RPC_URL`, and `EVM_*_RPC_URL` / `EVM_CHAIN_<id>_RPC_URL`
- Deployment overrides: `DEX_CHAIN_<CHAIN_ID>_<PROTOCOL>_<FIELD>`

Only add verified official deployments. Do not use placeholder addresses.

## Wallet Flow and Safety Notes

- Frontend validates injected wallet network before sending transaction (`wallet_switchEthereumChain` path).
- Quotes are estimates only; not guaranteed execution prices.
- Responses include warning messages around slippage/deadline and network matching.
- No private key collection or server-side signing is performed.
