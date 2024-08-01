// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.18;

import {Params, ISwapFactory} from "./Common.sol";
import {Swap} from "./Swap.sol";
import {SwapFactoryView} from "./SwapFactoryView.sol";


/// @title Contract for executing/canceling swaps
/// @notice Maker needs to transfer assets to the calculated swap address
/// @notice Taker needs to approve assets for the calculated swap address
contract SwapFactory is ISwapFactory, SwapFactoryView {
    // STORAGE
    address public invoker;
    mapping(address => mapping(uint256 => bool)) public maker_nonces;

    // ERROR
    error MakerNonceReused();
    error MakerDeadlineExpired();
    error TakerDeadlineExpired();
    error Unauthorized();

    // EVENT
    event Publish(address indexed _maker, uint256 indexed _nonce, Params _params);
    event Take(address indexed _maker, uint256 indexed _nonce, Params _params);
    event Bail(address indexed _maker, uint256 indexed _nonce, Params _params);

    modifier spendNonce(address _maker, uint256 _maker_nonce) {
        address prev = invoker;
        invoker = msg.sender;
        if (maker_nonces[_maker][_maker_nonce]) {
            revert MakerNonceReused(); // this also prevents reentrancy
        }
        maker_nonces[_maker][_maker_nonce] = true;
        _;
        invoker = prev;
    }

    // EXTERNAL

    /// @notice Execute the swap, taker gets maker_lot, maker gets taker_lot
    /// @notice If taker is 0x0 anyone can call this function, otherwise only taker
    /// @notice If taker_lot has ETH, it should be sent here
    function take(
        uint256 _taker_deadline,
        Params memory _params
    )
        external
        payable
        spendNonce(_params.create_args.maker, _params.maker_nonce)
    {
        address taker = _params.taker;
        uint256 maker_deadline = _params.maker_deadline;

        if (taker == address(0) || (msg.sender) == taker) {
            if (maker_deadline != 0 && maker_deadline < block.timestamp) {
                revert MakerDeadlineExpired();
            }
            if (_taker_deadline != 0 && _taker_deadline < block.timestamp) {
                revert TakerDeadlineExpired();
            }
        } else {
            revert Unauthorized();
        }

        _deploySwapContract(_params);
        emit Take(_params.create_args.maker, _params.maker_nonce, _params);
    }

    /// @notice Cancel the swap, returns assets to maker
    /// @notice Only maker can call this function
    function bail(
        Params memory _params
    )
        external
        spendNonce(_params.create_args.maker, _params.maker_nonce)
    {
        address maker = _params.create_args.maker;
        if (msg.sender != maker) {
            revert Unauthorized();
        }

        _deploySwapContract(_params);
        emit Bail(_params.create_args.maker, _params.maker_nonce, _params);
    }

    /// @notice Emit swap parameters for peer discovery
    function publish(Params memory _params) external {
        emit Publish(_params.create_args.maker, _params.maker_nonce, _params);
    }

    // INTERNAL
    function _deploySwapContract(Params memory _params) internal {
        bytes32 create2_salt = keccak256(abi.encode(_params));
        new Swap{salt: create2_salt, value: msg.value}(
            _params.create_args
        );
    }
}
