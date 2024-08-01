// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.18;

import {CreateArgs, ISwapFactory, IERC20, IERC721} from "./Common.sol";

/// @title Swap finalization contract
/// @notice if invoker is swap maker, will cancel the swap, otherwise will execute the swap
contract Swap {
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

    function _bail(CreateArgs memory _create_args) internal {
        // allowed to fail so that we don't brick other withdrawals
        _create_args.maker.call{value: address(this).balance}("");

        _pushOwnedERC20(_create_args.maker, _create_args.maker_lot.erc20);

        _pushOwnedERC721(
            _create_args.maker,
            _create_args.maker_lot.erc721,
            _create_args.maker_lot.erc721_ids
        );
    }

    function _take(address taker, CreateArgs memory _create_args) internal {
        // taker gets maker_lot or reverts
        payable(taker).transfer(_create_args.maker_lot.eth_amount);

        _pushERC20(
            taker,
            _create_args.maker_lot.erc20,
            _create_args.maker_lot.erc20_amounts
        );

        _pushERC721(
            taker,
            _create_args.maker_lot.erc721,
            _create_args.maker_lot.erc721_ids
        );

        // maker gets taker_lot or reverts
        payable(_create_args.maker).transfer(_create_args.taker_lot.eth_amount);

        _pullERC20(
            taker,
            _create_args.maker,
            _create_args.taker_lot.erc20,
            _create_args.taker_lot.erc20_amounts
        );

        _pullERC721(
            taker,
            _create_args.maker,
            _create_args.taker_lot.erc721,
            _create_args.taker_lot.erc721_ids
        );
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

    function _pushOwnedERC20(address _to, address[] memory _erc20) internal {
        for (uint256 i; i < _erc20.length; i++) {
            uint256 balance = IERC20(_erc20[i]).balanceOf(address(this));
            if (balance == 0) continue;
            bytes memory payload = abi.encodeWithSelector(
                IERC20.transfer.selector,
                _to,
                balance
            );
            // allowed to fail so that we don't brick other withdrawals
            _erc20[i].call(payload);
        }
    }

    function _pushOwnedERC721(
        address _to,
        address[] memory _erc721,
        uint256[] memory _ids
    ) internal {
        uint256 len = _erc721.length < _ids.length ? _erc721.length : _ids.length;
        for (uint256 i; i < len; i++) {
            address owner = IERC721(_erc721[i]).ownerOf(_ids[i]);
            if (owner != address(this)) continue;
            bytes memory payload = abi.encodeWithSelector(
                IERC721.transferFrom.selector,
                address(this),
                _to,
                _ids[i]
            );
            // allowed to fail so that we don't brick other withdrawals
            _erc721[i].call(payload);
        }
    }
}
