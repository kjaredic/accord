// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import {Params, ISwapFactory} from "./Common.sol";
import {TransientDeployProxy} from "./TransientDeployProxy.sol";

contract SwapFactory is ISwapFactory {
    // STORAGE
    address public invoker;
    mapping(address => mapping(uint256 => bool)) public maker_nonces;

    // ERROR
    error MakerNonceReused();
    error MakerDeadlineExpired();
    error TakerDeadlineExpired();
    error Unauthorized();

    // EVENT
    event Publish(
        address indexed _maker,
        uint256 indexed _nonce,
        Params _params
    );
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
    function take(
        uint256 _taker_deadline,
        Params memory _params
    )
        external
        payable
        spendNonce(_params.create_args.maker, _params.maker_nonce)
    {
        address taker = _params.create_args.taker;
        uint256 maker_deadline = _params.maker_deadline;

        if (taker == address(0) || (msg.sender) == taker) {
            taker = msg.sender;
            if (maker_deadline != 0 && maker_deadline < block.timestamp)
                revert MakerDeadlineExpired();
            if (_taker_deadline != 0 && _taker_deadline < block.timestamp)
                revert TakerDeadlineExpired();
        } else {
            revert Unauthorized();
        }

        _deployCreateProxy(_params);
        emit Take(_params.create_args.maker, _params.maker_nonce, _params);
    }

    function bail(
        Params memory _params
    )
        external
        payable
        spendNonce(_params.create_args.maker, _params.maker_nonce)
    {
        address maker = _params.create_args.maker;
        if (msg.sender != maker) {
            revert Unauthorized();
        }

        _deployCreateProxy(_params);
        emit Bail(_params.create_args.maker, _params.maker_nonce, _params);
    }

    function publishSwap(Params memory _params) external {
        emit Publish(_params.create_args.maker, _params.maker_nonce, _params);
    }

    // INTERNAL
    function _deployCreateProxy(Params memory _params) internal {
        bytes32 create2_salt = keccak256(abi.encode(_params));
        new TransientDeployProxy{salt: create2_salt, value: msg.value}(
            _params.create_args
        );
    }

    // VIEW
    function calculateSwapAddress(
        Params memory _params
    ) external view returns (address) {
        bytes32 create2_salt = keccak256(abi.encode(_params));
        bytes memory deploy_proxy_creationcode = type(TransientDeployProxy)
            .creationCode;
        bytes memory deploy_proxy_initcode = abi.encodePacked(
            deploy_proxy_creationcode,
            abi.encode(_params.create_args)
        );

        // create2 address
        bytes32 raw_proxy_digest = keccak256(
            abi.encodePacked(
                hex"ff",
                address(this),
                create2_salt,
                keccak256(deploy_proxy_initcode)
            )
        );
        address deploy_proxy_address = address(uint160(uint(raw_proxy_digest)));

        // create address
        bytes32 raw_swap_digest = keccak256(
            abi.encodePacked(hex"d694", deploy_proxy_address, hex"01")
        );
        // hex"d694" is the RLP header for bytes20
        // hex"01" will always be the nonce of a new address
        // coincidentally this also prevents nonce reuse but isn't relied upon
        return address(uint160(uint(raw_swap_digest)));
    }
}
