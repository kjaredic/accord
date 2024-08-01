// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {CreateArgs, ISwapFactory} from "./Common.sol";
import {TransientTakeContract} from "./TransientTakeContract.sol";
import {TransientBailContract} from "./TransientBailContract.sol";

/// @notice Deploys swap finalizing contract at calculated swap address
contract TransientDeployProxy {
    constructor(CreateArgs memory _create_args) payable {
        address invoker = ISwapFactory(msg.sender).invoker();

        if (invoker == _create_args.maker) {
            new TransientBailContract(_create_args);
        } else {
            new TransientTakeContract{value: msg.value}(_create_args);
        }

        assembly {
            return(0, 0)
        }
    }
}
