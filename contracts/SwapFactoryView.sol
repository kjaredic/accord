// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.24;

import {Lot, Params, ISwapFactory} from "./Common.sol";
import {Swap} from "./Swap.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

abstract contract SwapFactoryView {
    // VIEW
    function calculateSwapAddress(
        Params memory _params
    ) public view returns (address swap_address) {
        bytes32 create2_salt = keccak256(abi.encode(_params));
        bytes memory swap_creationcode = type(Swap).creationCode;
        bytes memory swap_initcode = abi.encodePacked(
            swap_creationcode,
            abi.encode(_params.create_args)
        );

        // create2 address
        bytes32 digest = keccak256(
            abi.encodePacked(
                hex"ff",
                address(this),
                create2_salt,
                keccak256(swap_initcode)
            )
        );
        swap_address = address(uint160(uint(digest)));
    }

    function getPendingApprovalsMaker(
        Params memory _params
    ) external view returns (Lot memory lot) {
        address swap_address = calculateSwapAddress(_params);
        lot = _getPendingApprovals(
            swap_address,
            _params.create_args.maker,
            _params.create_args.maker_lot
        );
        uint256 swap_address_balance = swap_address.balance;
        if (lot.eth_amount < swap_address_balance) {
            lot.eth_amount = 0;
        } else {
            lot.eth_amount = lot.eth_amount - swap_address_balance;
        }
    }

    function getPendingApprovalsTaker(
        address _taker,
        Params memory _params
    ) external view returns (Lot memory lot) {
        address swap_address = calculateSwapAddress(_params);
        lot = _getPendingApprovals(
            swap_address,
            _taker,
            _params.create_args.taker_lot
        );
    }

    // INTERNAL
    function _getPendingApprovals(
        address _swap_address,
        address _user,
        Lot memory _lot
    ) internal view returns (Lot memory) {
        address[] memory erc20 = _lot.erc20;
        uint256[] memory erc20_amounts = _lot.erc20_amounts;
        address[] memory erc721 = _lot.erc721;
        uint256[] memory erc721_ids = _lot.erc721_ids;

        uint256 erc20_count = 0;
        uint256 erc721_count = 0;

        for (uint256 i; i < erc20.length; i++) {
            uint256 erc20_balance = IERC20(erc20[i]).allowance(
                _user,
                _swap_address
            );
            uint256 remaining = erc20_balance > erc20_amounts[i]
                ? 0
                : erc20_amounts[i] - erc20_balance;

            erc20_amounts[i] = remaining;
            if (remaining != 0) {
                erc20[erc20_count] = erc20[i];
                erc20_amounts[erc20_count++] = remaining;
            }
        }

        for (uint256 i; i < erc721.length; i++) {
            address erc721_spender = IERC721(erc721[i]).getApproved(
                erc721_ids[i]
            );
            if (erc721_spender != _swap_address) {
                erc721[erc721_count] = erc721[i];
                erc721_ids[erc721_count++] = erc721_ids[i];
            }
        }

        // truncate arrays instead of making copies
        assembly {
            mstore(erc20, erc20_count)
            mstore(erc20_amounts, erc20_count)
            mstore(erc721, erc721_count)
            mstore(erc721_ids, erc721_count)
        }

        return _lot;
    }
}
