import { ethers } from 'hardhat';
import { LotStruct, ParamsStruct } from '../typechain-types/contracts/SwapFactoryView';
import { expect } from 'chai';
import { AddressLike, Signer } from 'ethers';
import { calculateSwapAddress } from '../sdk/utils';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { SwapFactory } from '../typechain-types';

export class VirtualSwapObject {
    public readonly swap_factory_address: Readonly<string>;
    public readonly params: Readonly<ParamsStruct>;

    constructor({
        swap_factory_address,
        params,
    }: {
        swap_factory_address: Readonly<string>,
        params: Readonly<ParamsStruct>,
    }) {
        // there must be a cleaner solution but its not worth the time
        // deep copy
        this.swap_factory_address = swap_factory_address;
        const maker_lot = params.create_args.maker_lot;
        const taker_lot = params.create_args.taker_lot;
        this.params = {
            maker_nonce: params.maker_nonce,
            maker_deadline: params.maker_deadline,
            taker: params.taker,
            create_args: {
                maker: params.create_args.maker,
                maker_lot: {
                    eth_amount: maker_lot.eth_amount,
                    erc20: maker_lot.erc20.slice(),
                    erc20_amounts: maker_lot.erc20_amounts.slice(),
                    erc721: maker_lot.erc721.slice(),
                    erc721_ids: maker_lot.erc721_ids.slice(),
                },
                taker_lot: {
                    eth_amount: taker_lot.eth_amount,
                    erc20: taker_lot.erc20.slice(),
                    erc20_amounts: taker_lot.erc20_amounts.slice(),
                    erc721: taker_lot.erc721.slice(),
                    erc721_ids: taker_lot.erc721_ids.slice(),
                }
            },
        };
    }

    async take(signer: Signer, taker_deadline: bigint) {
        const { swap_factory, swap_address } = await this._verifyAddressCalculation();

        const taker_eth_amount = this.params.create_args.taker_lot.eth_amount;
        const tx = await swap_factory
            .connect(signer)
            .take(taker_deadline, this.params, {value: taker_eth_amount})
            .then((r) => r.wait())
            .then((r) => r!);

        await this._verifySwapExecution({
            swap_factory, swap_address,
        });
        return tx;
    }

    async bail(signer: Signer) {
        const { swap_factory, swap_address } = await this._verifyAddressCalculation();

        const tx = await swap_factory
            .connect(signer)
            .bail(this.params)
            .then((r) => r.wait())
            .then((r) => r!);

        await this._verifySwapExecution({
            swap_factory, swap_address,
        });
        return tx;
    }

    async publish(signer: Signer) {
        const { swap_factory } = await this._verifyAddressCalculation();

        const tx = await swap_factory
            .connect(signer)
            .publish(this.params)
            .then((r) => r.wait())
            .then((r) => r!);

        return tx;
    }

    async approveMaker(signer: HardhatEthersSigner) {
        const { swap_address, swap_factory } = await this._verifyAddressCalculation();
        const maker_lot = await swap_factory.getPendingApprovalsMaker(this.params);
        if (maker_lot.eth_amount != 0n) {
            await signer.sendTransaction({ to: swap_address, value: maker_lot.eth_amount });
        }
        return this._approve(signer, maker_lot, swap_address);
    }

    async approveTaker(signer: HardhatEthersSigner) {
        const { swap_address, swap_factory } = await this._verifyAddressCalculation();
        const taker_lot = await swap_factory.getPendingApprovalsTaker(signer.address, this.params);
        return this._approve(signer, taker_lot, swap_address);
    }

    private async _approve(signer: HardhatEthersSigner, lot: LotStruct, swap_address: string) {
        await Promise.all(lot.erc20.map(
            async (e, i) => {
                const token = await ethers.getContractAt('IERC20', e.toString());
                return token.connect(signer).approve(swap_address, lot.erc20_amounts[i]);
            },
        ));
        await Promise.all(lot.erc721.map(
            async (e, i) => {
                const token = await ethers.getContractAt('IERC721', e.toString());
                return token.connect(signer).approve(swap_address, lot.erc721_ids[i]);
            },
        ));
    }

    private async _verifyAddressCalculation() {
        const swap_factory = await ethers.getContractAt('SwapFactory', this.swap_factory_address);
        const swap_address = calculateSwapAddress(this);
        const view_swap_address = swap_factory.calculateSwapAddress(this.params);
        await expect(
            view_swap_address,
            'Bad SwapFactory::calculateSwapAddress()',
        ).to.eventually.be.eq(swap_address);

        return { swap_factory, swap_address };
    }

    private async _verifySwapExecution({
        swap_factory,
        swap_address,
    }: {
        swap_factory: SwapFactory,
        swap_address: AddressLike,
    }) {
        await expect(
            ethers.provider.getTransactionCount(swap_address),
            'Failed to deploy swap contract',
        ).to.eventually.eq(1);

        await expect(
            swap_factory.maker_nonces(this.params.create_args.maker, this.params.maker_nonce),
            'Maker nonce not spent',
        ).to.eventually.be.true;

        await expect(
            ethers.provider.getCode(swap_address),
            'Swap contract persisted runtime',
        ).to.eventually.be.eq('0x');
    }
}