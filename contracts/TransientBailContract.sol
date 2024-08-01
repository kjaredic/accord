// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {IERC20, IERC721, CreateArgs} from "./Common.sol";

/// @notice Cancels swap
/// @notice Will send all owned assets from maker_lot to maker
contract TransientBailContract {
    constructor(CreateArgs memory _create_args) {
        payable(_create_args.maker).transfer(
            address(this).balance
        );

        _pushOwnedERC20(
            _create_args.maker,
            _create_args.maker_lot.erc20
        );

        _pushOwnedERC721(
            _create_args.maker,
            _create_args.maker_lot.erc721,
            _create_args.maker_lot.erc721_ids
        );

        assembly {
            return(0, 0)
        }
    }

    function _pushOwnedERC20(
        address _to,
        address[] memory _erc20
    ) internal {
        for (uint256 i; i < _erc20.length; i++) {
            uint256 balance = IERC20(_erc20[i]).balanceOf(address(this));
            if (balance == 0) continue;
            IERC20(_erc20[i]).transfer(_to, balance);
        }
    }

    function _pushOwnedERC721(
        address _to,
        address[] memory _erc721,
        uint256[] memory _ids
    ) internal {
        for (uint256 i; i < _erc721.length; i++) {
            address owner = IERC721(_erc721[i]).ownerOf(_ids[i]);
            if (owner != address(this)) continue;
            IERC721(_erc721[i]).transferFrom(address(this), _to, _ids[i]);
        }
    }
}
