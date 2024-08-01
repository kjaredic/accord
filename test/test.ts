import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { ParamsStruct } from '../typechain-types/SwapFactory';
import { VirtualSwapObject } from '../sdk';
import { expect } from 'chai';
import { generateBailBalanceCheck, generateBalanceCheck, generateTestCase } from './test-utils';
import { printParams } from '../sdk/utils';
import { ZeroAddress } from 'ethers';

const base_fixture = async () => {
    const [signer, maker, taker, random] = await ethers.getSigners();
    const swap_factory = await ethers
        .getContractFactory('SwapFactory')
        .then((c) => c.connect(signer).deploy());
    const swap_factory_address = await swap_factory.getAddress();

    const to_block = await ethers.provider.getBlockNumber();
    const params = await generateTestCase(maker.address, taker.address, to_block - 1);
    const swapObj = new VirtualSwapObject({ swap_factory_address, params });

    printParams(params);

    return {
        swapObj,
        swap_factory,
        maker, taker, random,
    };
};

const take_fixture = async () => {
    const fixture_params = await loadFixture(base_fixture);
    const taker_deadline = 0n;

    await fixture_params.swapObj.transfer(fixture_params.maker);
    await fixture_params.swapObj.approve(fixture_params.taker);

    const balanceChecker = await generateBalanceCheck(fixture_params.taker.address, fixture_params.swapObj.params);
    const take_tx = await fixture_params.swapObj.take(fixture_params.taker, taker_deadline);
    await balanceChecker(take_tx);

    return {
        take_tx,
        ...fixture_params,
    };
};

const bail_fixture = async () => {
    const fixture_params = await loadFixture(base_fixture);

    await fixture_params.swapObj.transfer(fixture_params.maker);
    const balanceChecker = await generateBailBalanceCheck(fixture_params.swapObj.params);
    const bail_tx = await fixture_params.swapObj.bail(fixture_params.maker);
    await balanceChecker(bail_tx);

    return {
        bail_tx,
        ...fixture_params,
    };
};

describe('SwapFactory Tests', function () {
    this.timeout(120_000);

    describe('SwapFactory::take flow', async () => {
        it('... should execute private swap', async () => {
            const { take_tx: { gasUsed } } = await loadFixture(take_fixture);
            console.log('Take gasUsed', gasUsed);
        });

        it('... should execute public swap', async () => {
            const fixture_params = await loadFixture(base_fixture);
            const { swapObj, maker, taker} = fixture_params;
            const taker_deadline = 0n;

            const publicSwapObj = new VirtualSwapObject(swapObj);
            const publicSwapParams = publicSwapObj.params as ParamsStruct;
            publicSwapParams.taker = ZeroAddress;

            await publicSwapObj.transfer(maker);
            await publicSwapObj.approve(taker);

            const balanceChecker = await generateBalanceCheck(taker.address, publicSwapObj.params);
            const take_tx = await publicSwapObj.take(taker, taker_deadline);
            await balanceChecker(take_tx);

            return {
                take_tx,
                ...fixture_params,
            };
        });

        it('... should revert on nonce reuse', async () => {
            const { swapObj, swap_factory, taker, maker } = await loadFixture(take_fixture);

            const taker_deadline = 0n;
            await expect(
                swapObj.take(taker, taker_deadline), 'Taker managed to reuse nonce',
            ).to.be.revertedWithCustomError(swap_factory, 'MakerNonceReused');

            await expect(
                swapObj.bail(maker), 'Maker managed to reuse nonce',
            ).to.be.revertedWithCustomError(swap_factory, 'MakerNonceReused');
        });

        it('... should revert on unauthorized access', async () => {
            const { swapObj, swap_factory, maker, random } = await loadFixture(base_fixture);

            const taker_deadline = 0n;
            await expect(
                swapObj.take(maker, taker_deadline), 'Maker managed to take',
            ).to.be.revertedWithCustomError(swap_factory, 'Unauthorized');
            await expect(
                swapObj.take(random, taker_deadline), 'Random managed to take',
            ).to.be.revertedWithCustomError(swap_factory, 'Unauthorized');
        });

        it('... should revert on expired deadline', async () => {
            const { swap_factory, taker, swapObj } = await loadFixture(base_fixture);
            let taker_deadline = 1n;

            await expect(
                swapObj.take(taker, taker_deadline), 'Taker deadline avoided',
            ).to.be.revertedWithCustomError(swap_factory, 'TakerDeadlineExpired');

            taker_deadline = 0n;

            const expiredswapObj = new VirtualSwapObject(swapObj);
            const expiredSwapParams = expiredswapObj.params as ParamsStruct;
            expiredSwapParams.maker_deadline = 1n;

            await expect(
                expiredswapObj.take(taker, taker_deadline), 'Maker deadline avoided',
            ).to.be.revertedWithCustomError(swap_factory, 'MakerDeadlineExpired');
        });
    });

    describe('SwapFactory::bail flow', async () => {
        it('... should cancel swap', async () => {
            const { bail_tx: { gasUsed } } = await loadFixture(bail_fixture);
            console.log('Bail gasUsed', gasUsed);
        });

        it('... should revert on nonce reuse', async () => {
            const { swapObj, swap_factory, taker, maker } = await loadFixture(bail_fixture);

            const taker_deadline = 0n;
            await expect(
                swapObj.take(taker, taker_deadline), 'Taker managed to reuse nonce',
            ).to.be.revertedWithCustomError(swap_factory, 'MakerNonceReused');

            await expect(
                swapObj.bail(maker), 'Maker managed to reuse nonce',
            ).to.be.revertedWithCustomError(swap_factory, 'MakerNonceReused');
        });

        it('... should revert on unauthorized access', async () => {
            const { swapObj, swap_factory, taker, random } = await loadFixture(base_fixture);

            await expect(
                swapObj.bail(taker), 'Taker managed to bail',
            ).to.be.revertedWithCustomError(swap_factory, 'Unauthorized');
            await expect(
                swapObj.bail(random), 'Random managed to bail',
            ).to.be.revertedWithCustomError(swap_factory, 'Unauthorized');
        });
    });
});
