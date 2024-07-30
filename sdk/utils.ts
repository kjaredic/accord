import TransientDeployProxyAbi from '../artifacts/contracts/TransientDeployProxy.sol/TransientDeployProxy.json';
import { ethers } from 'hardhat';
import { ParamsStruct, CreateArgsStruct } from '../typechain-types/SwapFactory';
import { Signer, ZeroAddress } from 'ethers';

const deploy_proxy_cretioncode = TransientDeployProxyAbi.bytecode;
const coder = ethers.AbiCoder.defaultAbiCoder();

const LOT_TYPE = `(
    uint256 eth_amount,
    address[] erc20,
    uint256[] erc20_amounts,
    address[] erc721,
    uint256[][] erc721_ids,
)`;
const CREATE_ARGS_TYPE = `(
    address maker,
    address taker,
    ${LOT_TYPE} maker_lot,
    ${LOT_TYPE} taker_lot,
)`;
const PARAMS_TYPE = `(
    uint256 maker_nonce,
    uint256 maker_deadline,
    ${CREATE_ARGS_TYPE} create_args,
)`;

export function generate_swap_params() {
    return {
        maker_nonce: 0n,
        maker_deadline: 0n,
        create_args: {
            maker: ZeroAddress,
            taker: ZeroAddress,
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

    const deploy_proxy_initcode = ethers.solidityPacked(
        ['bytes', 'bytes'],
        [
            deploy_proxy_cretioncode,
            coder.encode([CREATE_ARGS_TYPE],
                [params.create_args],),
        ],
    );
    const deploy_proxy_address = ethers.getCreate2Address(
        swap_factory_address,
        create2_salt,
        ethers.keccak256(deploy_proxy_initcode),
    );
    const swap_address = ethers.getCreateAddress({ from: deploy_proxy_address, nonce: 1n });

    return { deploy_proxy_address, swap_address };
}