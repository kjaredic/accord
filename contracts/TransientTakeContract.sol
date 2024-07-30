// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {IERC20, IERC721, CreateArgs} from "./Common.sol";

contract TransientTakeContract {
    constructor(CreateArgs memory _create_args) payable {
        payable(_create_args.maker).transfer(_create_args.taker_lot.eth_amount);
        payable(_create_args.taker).transfer(_create_args.maker_lot.eth_amount);

        for (uint256 i; i < _create_args.maker_lot.erc20.length; i++) {
            IERC20(_create_args.maker_lot.erc20[i]).transfer(
                _create_args.taker,
                _create_args.maker_lot.erc20_amounts[i]
            );
        }
        for (uint256 i; i < _create_args.taker_lot.erc20.length; i++) {
            IERC20(_create_args.taker_lot.erc20[i]).transferFrom(
                _create_args.taker,
                _create_args.maker,
                _create_args.taker_lot.erc20_amounts[i]
            );
        }

        for (uint256 i; i < _create_args.maker_lot.erc721.length; i++) {
            for (uint j; j < _create_args.maker_lot.erc721_ids[i].length; j++) {
                IERC721(_create_args.maker_lot.erc721[i]).transferFrom(
                    address(this),
                    _create_args.taker,
                    _create_args.maker_lot.erc721_ids[i][j]
                );
            }
        }
        for (uint256 i; i < _create_args.taker_lot.erc721.length; i++) {
            for (uint j; j < _create_args.taker_lot.erc721_ids[i].length; j++) {
                IERC721(_create_args.taker_lot.erc721[i]).transferFrom(
                    _create_args.taker,
                    _create_args.maker,
                    _create_args.taker_lot.erc721_ids[i][j]
                );
            }
        }

        assembly {
            return(0, 0)
        }
    }
}
