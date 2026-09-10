import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { createRequire } from "node:module";

const rootRequire = createRequire(new URL("../package.json", import.meta.url));

export default {
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.28",
    path: rootRequire.resolve("solc/soljson.js"),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
      mining: { auto: true, interval: 0 },
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        accountsBalance: "10000000000000000000000",
      },
    },
    atlasx: {
      type: "http",
      url: process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      },
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};
