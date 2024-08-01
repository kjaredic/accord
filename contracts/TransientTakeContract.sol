// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {IERC20, IERC721, CreateArgs} from "./Common.sol";

/// @title Executes swap
contract TransientTakeContract {
    constructor(CreateArgs memory _create_args) payable {
        payable(_create_args.taker).transfer(_create_args.maker_lot.eth_amount);

        _pushERC20(
            _create_args.taker,
            _create_args.maker_lot.erc20,
            _create_args.maker_lot.erc20_amounts
        );

        _pushERC721(
            _create_args.taker,
            _create_args.maker_lot.erc721,
            _create_args.maker_lot.erc721_ids
        );

        payable(_create_args.maker).transfer(_create_args.taker_lot.eth_amount);

        _pullERC20(
            _create_args.taker,
            _create_args.maker,
            _create_args.taker_lot.erc20,
            _create_args.taker_lot.erc20_amounts
        );

        _pullERC721(
            _create_args.taker,
            _create_args.maker,
            _create_args.taker_lot.erc721,
            _create_args.taker_lot.erc721_ids
        );

        assembly {
            return(0, 0)
        }
    }

    function _pushERC20(
        address _to,
        address[] memory _erc20,
        uint256[] memory _amounts
    ) internal {
        for (uint256 i; i < _erc20.length; i++) {
            IERC20(_erc20[i]).transfer(
                _to,
                _amounts[i]
            );
        }
    }

    function _pullERC20(
        address _from,
        address _to,
        address[] memory _erc20,
        uint256[] memory _amounts
    ) internal {
        for (uint256 i; i < _erc20.length; i++) {
            IERC20(_erc20[i]).transferFrom(
                _from,
                _to,
                _amounts[i]
            );
        }
    }

    function _pushERC721(
        address _to,
        address[] memory _erc721,
        uint256[] memory _ids
    ) internal {
        for (uint256 i; i < _erc721.length; i++) {
            IERC721(_erc721[i]).transferFrom(
                address(this),
                _to,
                _ids[i]
            );
        }
    }

    function _pullERC721(
        address _from,
        address _to,
        address[] memory _erc721,
        uint256[] memory _ids
    ) internal {
        for (uint256 i; i < _erc721.length; i++) {
            IERC721(_erc721[i]).transferFrom(
                _from,
                _to,
                _ids[i]
            );
        }
    }
}
