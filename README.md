# Accord

Accord is a swap protocol that enables two parties to swap arbitrary lots of assets.
Each swap has it's own address, and is uniquely defined by the parties, lots and a nonce.

There are two roles in a swap, one is the maker role, the other is the taker.
They make their assets available via approval, and in case the maker is offering native ETH, a transfer to the swap address. If all balances, approvals and swap input data are correct the taker and only the taker can choose to execute the swap. At any point before this, the maker can choose to cancel the swap and pull his ETH (if any).

## Running tests
Clone this repository and run:

`$ yarn && yarn test`

## Technical overview

The principle mechanism used to create swaps is deterministic contract deployment.
This has some advantages, as well as some disadvantages as we will later see.

The main entrypoint is the SwapFactory contract, with the user facing take() and bail() functions.
These functions employ different assertions but deploy the same Swap contract at the same address via create2.

## Security considerations

The soundness of this protocol relies on the difficulty of finding different valid inputs that generate the same swap address. The swap address is calculated like so (static arguments and encoding not included):

`swap_address = keccak256(keccak256(params) + keccak256(create_args))`

I'm not a cryptographer, but as far as I know this problem is hard.

## Security notice

This protocol in no way curates the swapped assets. It's possible to brick both the execution and calcelation of a swap. However only the maker can brick himself out of ETH, all other failures result in an invalid and non executable swap. It's at the makers and takers behest to review the swapped assets before spending gas on approvals.
