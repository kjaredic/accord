import SwapAbi from '../artifacts/contracts/Swap.sol/Swap.json';
import { ethers } from 'hardhat';
import { ParamsStruct, CreateArgsStruct } from '../typechain-types/contracts/SwapFactoryView';
import { ZeroAddress } from 'ethers';
import { erc20_list, erc721_list } from '../test/test-data';

const swap_cretioncode = SwapAbi.bytecode;
const coder = ethers.AbiCoder.defaultAbiCoder();

const LOT_TYPE = `(
    uint256 eth_amount,
    address[] erc20,
    uint256[] erc20_amounts,
    address[] erc721,
    uint256[] erc721_ids,
)`;
const CREATE_ARGS_TYPE = `(
    address maker,
    ${LOT_TYPE} maker_lot,
    ${LOT_TYPE} taker_lot,
)`;
const PARAMS_TYPE = `(
    uint256 maker_nonce,
    uint256 maker_deadline,
    address taker,
    ${CREATE_ARGS_TYPE} create_args,
)`;

export function generate_swap_params() {
    return {
        maker_nonce: 0n,
        maker_deadline: 0n,
        taker: ZeroAddress,
        create_args: {
            maker: ZeroAddress,
            maker_lot: {
                eth_amount: 0n,
                erc20: [],
                erc20_amounts: [],
                erc721: [],
                erc721_ids: [],
            },
            taker_lot: {
                eth_amount: 0n,
                erc20: [],
                erc20_amounts: [],
                erc721: [],
                erc721_ids: [],
            },
        } as CreateArgsStruct,
    } as ParamsStruct;
};

export function calculateSwapAddress({
    swap_factory_address,
    params,
}: {
    swap_factory_address: string,
    params: ParamsStruct,
}) {
    const create2_salt = ethers.keccak256(coder.encode(
        [PARAMS_TYPE],
        [params],
    ));

    const swap_initcode = ethers.solidityPacked(
        ['bytes', 'bytes'],
        [
            swap_cretioncode,
            coder.encode([CREATE_ARGS_TYPE],
                [params.create_args],),
        ],
    );
    const swap_address = ethers.getCreate2Address(
        swap_factory_address,
        create2_salt,
        ethers.keccak256(swap_initcode),
    );

    return swap_address;
}

export function printParams(params: ParamsStruct) {
    const maker_lot = params.create_args.maker_lot;
    const maker_lot_tag_list = [];

    if (maker_lot.eth_amount != 0n) maker_lot_tag_list.push(`${(Number(maker_lot.eth_amount) / 1e18).toFixed(2)} ETH`);
    for (let i = 0; i < maker_lot.erc20.length; i++) {
        const token = maker_lot.erc20[i];
        const { symbol, decimals } = erc20_list.find(({address}) => address === token)!;
        const amount = maker_lot.erc20_amounts[i];
        maker_lot_tag_list.push(`${(Number(amount) / (10 ** decimals)).toFixed(2)} ${symbol}`);
    }
    for (let i = 0; i < maker_lot.erc721.length; i++) {
        const token = maker_lot.erc721[i];
        const { symbol } = erc721_list.find(({address}) => address === token)!;
        const id = maker_lot.erc721_ids[i];
        maker_lot_tag_list.push(`${symbol}#${id}`);
    }

    const taker_lot = params.create_args.taker_lot;
    const taker_lot_tag_list = [];

    if (taker_lot.eth_amount != 0n) taker_lot_tag_list.push(`${(Number(taker_lot.eth_amount) / 1e18).toFixed(2)} ETH`);
    for (let i = 0; i < taker_lot.erc20.length; i++) {
        const token = taker_lot.erc20[i];
        const { symbol, decimals } = erc20_list.find(({address}) => address === token)!;
        const amount = taker_lot.erc20_amounts[i];
        taker_lot_tag_list.push(`${(Number(amount) / (10 ** decimals)).toFixed(2)} ${symbol}`);
    }
    for (let i = 0; i < taker_lot.erc721.length; i++) {
        const token = taker_lot.erc721[i];
        const { symbol } = erc721_list.find(({address}) => address === token)!;
        const id = taker_lot.erc721_ids[i];
        taker_lot_tag_list.push(`${symbol}#${id}`);
    }

    console.log('maker lot:', maker_lot_tag_list);
    console.log('taker lot:', taker_lot_tag_list);
}