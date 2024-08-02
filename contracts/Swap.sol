// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.24;

import {CreateArgs, ISwapFactory} from "./Common.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Swap finalization contract
/// @notice If invoker is swap maker, will cancel the swap, otherwise will execute the swap
/// @notice Will revert on invalid input, missing approvals/balances and bricked maker recieve function
contract Swap {
    using SafeERC20 for IERC20;

    constructor(CreateArgs memory _create_args) payable {
        address invoker = ISwapFactory(msg.sender).invoker();

        if (invoker == _create_args.maker) {
            _bail(_create_args);
        } else {
            _take(invoker, _create_args);
        }

        assembly {
            return(0, 0)
        }
    }

    // INTERNAL
    function _bail(CreateArgs memory _create_args) internal {
        // can revert, maker can brick his own eth if he so chooses
        // the alternative is to lock the eth forever
        payable(_create_args.maker).transfer(address(this).balance);
    }

    function _take(address _taker, CreateArgs memory _create_args) internal {
        // taker gets maker_lot or reverts
        payable(_taker).transfer(_create_args.maker_lot.eth_amount);

        _pullERC20(
            _create_args.maker,
            _taker,
            _create_args.maker_lot.erc20,
            _create_args.maker_lot.erc20_amounts
        );

        _pullERC721(
            _create_args.maker,
            _taker,
            _create_args.maker_lot.erc721,
            _create_args.maker_lot.erc721_ids
        );

        // maker gets taker_lot or reverts
        payable(_create_args.maker).transfer(_create_args.taker_lot.eth_amount);

        _pullERC20(
            _taker,
            _create_args.maker,
            _create_args.taker_lot.erc20,
            _create_args.taker_lot.erc20_amounts
        );

        _pullERC721(
            _taker,
            _create_args.maker,
            _create_args.taker_lot.erc721,
            _create_args.taker_lot.erc721_ids
        );
    }

    function _pullERC20(
        address _from,
        address _to,
        address[] memory _erc20,
        uint256[] memory _amounts
    ) internal {
        for (uint256 i; i < _erc20.length; i++) {
            IERC20(_erc20[i]).safeTransferFrom(_from, _to, _amounts[i]);
        }
    }

    function _pullERC721(
        address _from,
        address _to,
        address[] memory _erc721,
        uint256[] memory _ids
    ) internal {
        for (uint256 i; i < _erc721.length; i++) {
            IERC721(_erc721[i]).transferFrom(_from, _to, _ids[i]);
        }
    }
}
