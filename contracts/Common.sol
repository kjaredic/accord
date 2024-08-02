// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.24;

struct Lot {
    uint256 eth_amount;
    address[] erc20;
    uint256[] erc20_amounts;
    address[] erc721;
    uint256[] erc721_ids;
}

struct CreateArgs {
    address maker;
    Lot maker_lot;
    Lot taker_lot;
}

struct Params {
    uint256 maker_nonce;
    uint256 maker_deadline;
    address taker;
    CreateArgs create_args;
}

interface ISwapFactory {
    function invoker() external view returns (address);
}
