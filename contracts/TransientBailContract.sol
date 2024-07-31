// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {IERC20, IERC721, CreateArgs} from "./Common.sol";

contract TransientBailContract {
    constructor(CreateArgs memory _create_args) payable {
        payable(_create_args.maker).transfer(_create_args.maker_lot.eth_amount);

        for (uint256 i; i < _create_args.maker_lot.erc20.length; i++) {
            IERC20(_create_args.maker_lot.erc20[i]).transfer(
                _create_args.maker,
                _create_args.maker_lot.erc20_amounts[i]
            );
        }

        for (uint256 i; i < _create_args.maker_lot.erc721.length; i++) {
            IERC721(_create_args.maker_lot.erc721[i]).transferFrom(
                address(this),
                _create_args.maker,
                _create_args.maker_lot.erc721_ids[i]
            );
        }

        assembly {
            return(0, 0)
        }
    }
}
