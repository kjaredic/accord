// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {IERC20, IERC721, CreateArgs} from "./Common.sol";

contract TransientBailContract {
    constructor(CreateArgs memory _create_args) payable {
        address maker = _create_args.maker;
        address[] memory erc20 = _create_args.maker_lot.erc20;
        address[] memory erc721 = _create_args.maker_lot.erc721;
        uint256[] memory erc721_ids = _create_args.maker_lot.erc721_ids;

        uint256 eth_balance = address(this).balance;
        if (eth_balance != 0) {
            payable(maker).transfer(eth_balance);
        }

        for (uint256 i; i < erc20.length; i++) {
            uint256 balance = IERC20(erc20[i]).balanceOf(address(this));
            if (balance == 0) continue;
            IERC20(erc20[i]).transfer(
                maker,
                balance
            );
        }

        for (uint256 i; i < erc721.length; i++) {
            address owner = IERC721(erc721[i]).ownerOf(erc721_ids[i]);
            if (owner != address(this)) continue;
            IERC721(erc721[i]).transferFrom(
                address(this),
                maker,
                erc721_ids[i]
            );
        }

        assembly {
            return(0, 0)
        }
    }
}
