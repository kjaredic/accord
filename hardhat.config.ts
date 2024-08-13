import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import {config as dotenv} from 'dotenv-safe';
dotenv();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
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
