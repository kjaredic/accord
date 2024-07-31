import { ethers } from 'hardhat';
import { ParamsStruct, SwapFactory } from '../typechain-types/SwapFactory';
import { expect } from 'chai';
import { AddressLike, ContractTransactionReceipt, Signer } from 'ethers';
import { calculateSwapAddress } from '../sdk/utils';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

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
            create_args: {
                maker: params.create_args.maker,
                taker: params.create_args.taker,
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
        const { swap_factory, swap_address, deploy_proxy_address } = await this._verifyAddressCalculation();

        const taker_eth_amount = this.params.create_args.taker_lot.eth_amount;
        const tx = await swap_factory
            .connect(signer)
            .take(taker_deadline, this.params, {value: taker_eth_amount})
            .then((r) => r.wait())
            .then((r) => r!);

        await this._verifySwapExecution({
            swap_factory, swap_address, deploy_proxy_address,
        });
        return tx;
    }

    async bail(signer: Signer) {
        const { swap_factory, swap_address, deploy_proxy_address } = await this._verifyAddressCalculation();

        const tx = await swap_factory
            .connect(signer)
            .bail(this.params)
            .then((r) => r.wait())
            .then((r) => r!);

        await this._verifySwapExecution({
            swap_factory, swap_address, deploy_proxy_address,
        });
        return tx;
    }

    async transfer(signer: HardhatEthersSigner) {
        const { swap_address, swap_factory } = await this._verifyAddressCalculation();

        const maker = await ethers.getSigner(this.params.create_args.maker.toString());
        expect(signer.address).to.be.eq(maker.address);

        const maker_lot = await swap_factory.getPendingMakerLot(this.params);

        if (maker_lot.eth_amount != 0n) {
            await maker.sendTransaction({ to: swap_address, value: maker_lot.eth_amount});
        }
        await Promise.all(maker_lot.erc20.map(
            async (e, i) => {
                const token = await ethers.getContractAt('IERC20', e.toString());
                return token.connect(maker).transfer(swap_address, maker_lot.erc20_amounts[i]);
            },
        ));
        await Promise.all(maker_lot.erc721.map(
            async (e, i) => {
                const token = await ethers.getContractAt('IERC721', e.toString());
                return token.connect(maker).transferFrom(maker.address, swap_address, maker_lot.erc721_ids[i]);
            },
        ));
    }

    async approve(signer: HardhatEthersSigner) {
        const { swap_address, swap_factory } = await this._verifyAddressCalculation();

        const taker = await ethers.getSigner(this.params.create_args.taker.toString());
        expect(signer.address).to.be.eq(taker.address);

        const taker_lot = await swap_factory.getPendingTakerLot(this.params);
        await Promise.all(taker_lot.erc20.map(
            async (e, i) => {
                const token = await ethers.getContractAt('IERC20', e.toString());
                return token.connect(taker).approve(swap_address, taker_lot.erc20_amounts[i]);
            },
        ));
        await Promise.all(taker_lot.erc721.map(
            async (e, i) => {
                const token = await ethers.getContractAt('IERC721', e.toString());
                return token.connect(taker).approve(swap_address, taker_lot.erc721_ids[i]);
            },
        ));
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

    private async _verifyAddressCalculation() {
        const swap_factory = await ethers.getContractAt('SwapFactory', this.swap_factory_address);
        const { deploy_proxy_address, swap_address } = calculateSwapAddress(this);
        const view_swap_address = swap_factory.calculateSwapAddress(this.params);
        await expect(
            view_swap_address,
            'Bad SwapFactory::calculateSwapAddress()',
        ).to.eventually.be.eq(swap_address);

        return { swap_factory, swap_address, deploy_proxy_address };
    }

    private async _verifySwapExecution({
        swap_factory,
        swap_address,
        deploy_proxy_address,
    }: {
        swap_factory: SwapFactory,
        swap_address: AddressLike,
        deploy_proxy_address: AddressLike,
    }) {
        await expect(
            ethers.provider.getTransactionCount(swap_address),
            'Failed to deploy swap contract',
        ).to.eventually.eq(1);

        await expect(
            ethers.provider.getTransactionCount(deploy_proxy_address),
            'Failed to deploy deploy-proxy',
        ).to.eventually.eq(2);

        await expect(
            swap_factory.maker_nonces(this.params.create_args.maker, this.params.maker_nonce),
            'Maker nonce not spent',
        ).to.eventually.be.true;

        await expect(
            ethers.provider.getCode(swap_address),
            'Swap contract persisted runtime',
        ).to.eventually.be.eq('0x');

        await expect(
            ethers.provider.getCode(deploy_proxy_address),
            'Deploy proxy persisted runtime',
        ).to.eventually.be.eq('0x');
    }
}