// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {Lot, Params, ISwapFactory, IERC20, IERC721} from "./Common.sol";
import {Swap} from "./Swap.sol";

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

    function getPendingLots(
        address _taker,
        Params memory _params
    )
        external
        view
        returns (Lot memory pendingMakerLot, Lot memory pendingTakerLot)
    {
        pendingMakerLot = getPendingMakerLot(_params);
        pendingTakerLot = getPendingTakerLot(_taker, _params);
    }

    function getPendingMakerLot(
        Params memory _params
    ) public view returns (Lot memory pendingMakerLot) {
        Lot memory maker_lot = _params.create_args.maker_lot;
        address swap_address = calculateSwapAddress(_params);

        uint256 maker_erc20_count = 0;
        for (uint256 i; i < maker_lot.erc20.length; i++) {
            uint256 erc20_balance = IERC20(maker_lot.erc20[i]).balanceOf(
                swap_address
            );
            uint256 remaining = erc20_balance > maker_lot.erc20_amounts[i]
                ? 0
                : maker_lot.erc20_amounts[i] - erc20_balance;

            maker_lot.erc20_amounts[i] = remaining;
            if (remaining != 0) {
                maker_erc20_count++;
            }
        }

        uint256 maker_erc721_count = 0;
        for (uint256 i; i < maker_lot.erc721.length; i++) {
            address erc721_owner = IERC721(maker_lot.erc721[i]).ownerOf(
                maker_lot.erc721_ids[i]
            );
            if (erc721_owner != swap_address) {
                maker_erc721_count++;
            } else {
                maker_lot.erc721_ids[i] = type(uint256).max;
            }
        }

        pendingMakerLot = Lot(
            0,
            new address[](maker_erc20_count),
            new uint256[](maker_erc20_count),
            new address[](maker_erc721_count),
            new uint256[](maker_erc721_count)
        );

        pendingMakerLot.eth_amount = swap_address.balance > maker_lot.eth_amount
            ? 0
            : maker_lot.eth_amount - swap_address.balance;

        uint256 count;
        for (uint256 i; i < maker_lot.erc20.length; i++) {
            uint256 remaining = maker_lot.erc20_amounts[i];
            if (remaining != 0) {
                pendingMakerLot.erc20[count] = maker_lot.erc20[i];
                pendingMakerLot.erc20_amounts[count++] = maker_lot
                    .erc20_amounts[i];
            }
        }

        count = 0;
        for (uint256 i; i < maker_lot.erc721.length; i++) {
            if (maker_lot.erc721_ids[i] != type(uint256).max) {
                pendingMakerLot.erc721[count] = maker_lot.erc721[i];
                pendingMakerLot.erc721_ids[count++] = maker_lot.erc721_ids[i];
            }
        }
    }

    function getPendingTakerLot(
        address _taker,
        Params memory _params
    ) public view returns (Lot memory pendingTakerLot) {
        Lot memory taker_lot = _params.create_args.taker_lot;
        address swap_address = calculateSwapAddress(_params);

        uint256 taker_erc20_count = 0;
        for (uint256 i; i < taker_lot.erc20.length; i++) {
            uint256 erc20_balance = IERC20(taker_lot.erc20[i]).allowance(
                _taker,
                swap_address
            );
            uint256 remaining = erc20_balance > taker_lot.erc20_amounts[i]
                ? 0
                : taker_lot.erc20_amounts[i] - erc20_balance;

            taker_lot.erc20_amounts[i] = remaining;
            if (remaining != 0) {
                taker_erc20_count++;
            }
        }

        uint256 taker_erc721_count = 0;
        for (uint256 i; i < taker_lot.erc721.length; i++) {
            address erc721_spender = IERC721(taker_lot.erc721[i]).getApproved(
                taker_lot.erc721_ids[i]
            );
            if (erc721_spender != swap_address) {
                taker_erc721_count++;
            } else {
                taker_lot.erc721_ids[i] = type(uint256).max;
            }
        }

        pendingTakerLot = Lot(
            taker_lot.eth_amount,
            new address[](taker_erc20_count),
            new uint256[](taker_erc20_count),
            new address[](taker_erc721_count),
            new uint256[](taker_erc721_count)
        );

        uint256 count;
        for (uint256 i; i < taker_lot.erc20.length; i++) {
            uint256 remaining = taker_lot.erc20_amounts[i];
            if (remaining != 0) {
                pendingTakerLot.erc20[count] = taker_lot.erc20[i];
                pendingTakerLot.erc20_amounts[count++] = taker_lot
                    .erc20_amounts[i];
            }
        }

        count = 0;
        for (uint256 i; i < taker_lot.erc721.length; i++) {
            if (taker_lot.erc721_ids[i] != type(uint256).max) {
                pendingTakerLot.erc721[count] = taker_lot.erc721[i];
                pendingTakerLot.erc721_ids[count++] = taker_lot.erc721_ids[i];
            }
        }
    }
}
