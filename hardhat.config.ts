import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      forking: {
        url: process.env.RPC!,
        blockNumber: 20425417,
      }
    }
  }
};

export default config;
