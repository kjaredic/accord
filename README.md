# Accord

Accord is a swap protocol that enables two parties to swap arbitrary lots of assets.
Each swap has it's own address, and is uniquely defined by the parties, lots and a nonce.

There are two roles in a swap, one is the maker role, the other is the taker.
The maker role commits assets by sending them to the swap address, which he can withdraw at any point before the swap executes, canceling the swap.
The taker role makes his assets available via approvals to the swap address, and can execute the swap at any point before the maker cancels the swap.

## Running tests
Clone this repository and run:

`$ yarn && yarn run test`

## Technical overview

The principle mechanism used to create swaps is deterministic contract deployment.
This has some advantages, as well as some disadvantages as we will later see.

The main entrypoint is the SwapFactory contract, with the user facing take() and bail() functions.
These functions employ different assertions but deploy the same Swap contract at the same address via create2.

## Security considerations

The soundness of this protocol relies on the difficulty of finding different valid inputs that generate the same swap address. The swap address is calculated like so (static arguments and encoding not included):

`swap_address = keccak256(keccak256(params) + keccak256(create_args))`

I'm not a cryptographer, but as far as I know this problem is hard.

## Tradeoffs

- Advantages:
    - Nonreentrant - can't callback to contract in creation
    - Asset isolation
    - Dangling approvals can be ignored once the contract executes
    - No overhead for swap seeding (maker transfers, taker approvals)
- Disatvantages:
    - No on-chain validation for swap seeding
    - Complexity and reliance on sdk
    - Limited discoverability between parties
