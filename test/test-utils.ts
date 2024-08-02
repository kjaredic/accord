import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ContractTransactionReceipt, ZeroAddress } from "ethers";
import { ethers } from "hardhat";
import { erc20_list, erc721_list } from "./test-data";
import { generate_swap_params } from "../sdk/utils";
import { ParamsStruct } from "../typechain-types/SwapFactory";

export async function prankERC20Transfer({
    token,
    user,
    count,
    to_block,
    from_block,
}: {
    token: string,
    user: string,
    count?: number,
    to_block?: number,
    from_block?: number,
}) {
    const erc20 = await ethers.getContractAt('IERC20', token);
    const owner_book = new Map<string, bigint>();

    {
        count ||= 5;
        const toBlock: number = to_block || await ethers.provider.getBlockNumber().then((r) => r - 1);
        const fromBlock = from_block || toBlock - 100;

        const erc20_transfer_event = erc20.filters.Transfer();
        const events = await erc20.queryFilter(erc20_transfer_event, fromBlock, toBlock);

        events.slice(-count * count).forEach((e) => {
            const { from, to, value: amount } = e.args;

            if (to === token || to === ZeroAddress) {
                return;
            }

            const to_balance = owner_book.get(to) || 0n;
            owner_book.set(to, to_balance + amount);

            if (from === ZeroAddress || from === token) {
                return;
            }

            const from_balance = owner_book.get(from) || 0n;
            owner_book.set(from, from_balance - amount);
        });
    }

    const positive_owners = [...owner_book.entries()].filter(([_, amount]) => amount > 0n);
    positive_owners.sort(([_, a], [__, b]) => Number(b - a));
    const whale_owners = positive_owners.slice(0, count);

    const balance_before = await erc20.balanceOf(user);
    const prankPool = whale_owners.map(async ([owner, owner_amount]) => {
        if (owner_amount === 0n) {
            return;
        }

        await setBalance(owner, BigInt(1e20));
        const victim = await ethers.getImpersonatedSigner(owner);

        await erc20.connect(victim).transfer(user, owner_amount).catch(() => { });
    });

    await Promise.all(prankPool);
    const amount = await erc20.balanceOf(user).then((e) => e - balance_before);
    return { token, amount };
}

export async function prankERC721Transfer({
    token,
    user,
    count,
    to_block,
    from_block,
}: {
    token: string,
    user: string,
    count?: number,
    to_block?: number,
    from_block?: number,
}) {
    const erc721 = await ethers.getContractAt('IERC721', token);
    const id_book = new Map<bigint, string>();
    {
        count ||= 2;
        const toBlock: number = to_block || await ethers.provider.getBlockNumber().then((r) => r - 1);
        const fromBlock = from_block || toBlock - 1000;

        const erc721_transfer_event = erc721.filters.Transfer();
        const events = await erc721.queryFilter(erc721_transfer_event, fromBlock, toBlock);

        events.slice(-count * count).forEach((e) => {
            const { to, tokenId: id } = e.args;
            if (to === token || to === ZeroAddress) {
                id_book.delete(id);
            } else {
                id_book.set(id, to);
            }
        });
    }

    const victim_ids = [...id_book.entries()].slice(0, count);
    const prankPool = victim_ids.map(async ([id, owner]) => {
        await setBalance(owner, BigInt(1e20));
        const victim = await ethers.getImpersonatedSigner(owner);

        await erc721.connect(victim).transferFrom(victim, user, id);

        await expect(
            erc721.ownerOf(id),
            'Failed to prank erc721 transfer'
        ).to.eventually.be.eq(user);
    });

    await Promise.all(prankPool);
    return victim_ids.map(([id]) => ({ token, id }));
}

function randomIndex(n: number) {
    return Math.floor(Math.random() * n);
}

function randomSplitChoice<T>(arr: T[]) {
    const split_index = 1 + randomIndex(arr.length - 1);
    return [arr.slice(0, split_index), arr.slice(split_index)];
}

export async function generateTestCase(maker: string, taker: string, to_block: number) {
    const params = generate_swap_params();
    params.create_args.maker = maker;
    params.taker = taker;

    const [
        maker_erc20_choice,
        taker_erc20_choice,
    ] = randomSplitChoice(erc20_list);

    const [
        maker_erc721_choice,
        taker_erc721_choice,
    ] = randomSplitChoice(erc721_list);

    console.warn('stealing tokens for tests, slow the first time');
    {
        const maker_erc20 = await Promise.all(
            maker_erc20_choice.map(
                (e) => prankERC20Transfer({ token: e.address, user: maker, to_block }),
            ),
        );

        const maker_erc721_nested = await Promise.all(
            maker_erc721_choice.map(
                (e) => prankERC721Transfer({ token: e.address, user: maker, to_block }),
            ),
        );

        const maker_erc721 = maker_erc721_nested.reduce((acc, e) => [...acc, ...e], []);


        params.create_args.maker_lot.eth_amount = Math.random() > 0.5 ? BigInt(10e18) : 0;
        params.create_args.maker_lot.erc20 = maker_erc20.map(({ token }) => token);
        params.create_args.maker_lot.erc20_amounts = maker_erc20.map(({ amount }) => amount);
        params.create_args.maker_lot.erc721 = maker_erc721.map(({ token }) => token);
        params.create_args.maker_lot.erc721_ids = maker_erc721.map(({ id }) => id);
    }

    {
        const taker_erc20 = await Promise.all(
            taker_erc20_choice.map(
                (e) => prankERC20Transfer({ token: e.address, user: taker, to_block }),
            ),
        );

        const taker_erc721_nested = await Promise.all(
            taker_erc721_choice.map(
                (e) => prankERC721Transfer({ token: e.address, user: taker, to_block }),
            ),
        );

        const taker_erc721 = taker_erc721_nested.reduce((acc, e) => [...acc, ...e], []);

        params.create_args.taker_lot.eth_amount = Math.random() > 0.5 ? BigInt(10e18) : 0;
        params.create_args.taker_lot.erc20 = taker_erc20.map(({ token }) => token);
        params.create_args.taker_lot.erc20_amounts = taker_erc20.map(({ amount }) => amount);
        params.create_args.taker_lot.erc721 = taker_erc721.map(({ token }) => token);
        params.create_args.taker_lot.erc721_ids = taker_erc721.map(({ id }) => id);
    }

    return params;
}

export async function generateBalanceCheck(taker: string, params: ParamsStruct) {
    const maker = params.create_args.maker;
    const taker_lot = params.create_args.taker_lot;
    const maker_lot = params.create_args.maker_lot;

    const taker_eth_balance_before = await ethers.provider.getBalance(taker);
    const maker_eth_balance_before = await ethers.provider.getBalance(maker);

    const taker_erc20_balance_before = await Promise.all(
        maker_lot.erc20.map((token) => ethers.getContractAt('IERC20', token.toString()).then((c) => c.balanceOf(taker))),
    );
    const maker_erc20_balance_before = await Promise.all(
        taker_lot.erc20.map((token) => ethers.getContractAt('IERC20', token.toString()).then((c) => c.balanceOf(maker))),
    );

    return async (tx: ContractTransactionReceipt) => {
        const tx_cost = tx.gasPrice * tx.gasUsed;

        const taker_eth_balance_after = await ethers.provider.getBalance(taker);
        const maker_eth_balance_after = await ethers.provider.getBalance(maker);

        expect(maker_eth_balance_after - maker_eth_balance_before).to.be.eq(taker_lot.eth_amount);
        expect(taker_eth_balance_after - taker_eth_balance_before).to.be.eq(BigInt(maker_lot.eth_amount) - BigInt(taker_lot.eth_amount) - tx_cost);
        const taker_erc20_balance_after = await Promise.all(
            maker_lot.erc20.map((token) => ethers.getContractAt('IERC20', token.toString()).then((c) => c.balanceOf(taker))),
        );
        const maker_erc20_balance_after = await Promise.all(
            taker_lot.erc20.map((token) => ethers.getContractAt('IERC20', token.toString()).then((c) => c.balanceOf(maker))),
        );

        maker_lot.erc20_amounts.map((expected_amount, i) => {
            expect(taker_erc20_balance_after[i] - taker_erc20_balance_before[i]).to.be.eq(expected_amount);
        });

        taker_lot.erc20_amounts.map((expected_amount, i) => {
            expect(maker_erc20_balance_after[i] - maker_erc20_balance_before[i]).to.be.eq(expected_amount);
        });

        await Promise.all(maker_lot.erc721.map((token, i) => {
            const id_owner = ethers
                .getContractAt('IERC721', token.toString())
                .then((c) => c.ownerOf(maker_lot.erc721_ids[i]));
            return expect(id_owner).to.eventually.be.eq(taker);
        }));

        await Promise.all(taker_lot.erc721.map((token, i) => {
            const id_owner = ethers
                .getContractAt('IERC721', token.toString())
                .then((c) => c.ownerOf(taker_lot.erc721_ids[i]));
            return expect(id_owner).to.eventually.be.eq(maker);
        }));
    }

}

export async function generateBailBalanceCheck(params: ParamsStruct) {
    const maker = params.create_args.maker;
    const maker_lot = params.create_args.maker_lot;

    const maker_eth_balance_before = await ethers.provider.getBalance(maker);

    const maker_erc20_balance_before = await Promise.all(
        maker_lot.erc20.map((token) => ethers.getContractAt('IERC20', token.toString()).then((c) => c.balanceOf(maker))),
    );

    return async (tx: ContractTransactionReceipt) => {
        const tx_cost = tx.gasPrice * tx.gasUsed;

        const maker_eth_balance_after = await ethers.provider.getBalance(maker);

        expect(maker_eth_balance_after - maker_eth_balance_before).to.be.eq(BigInt(maker_lot.eth_amount) - tx_cost);

        const maker_erc20_balance_after = await Promise.all(
            maker_lot.erc20.map((token) => ethers.getContractAt('IERC20', token.toString()).then((c) => c.balanceOf(maker))),
        );

        maker_lot.erc20_amounts.map((expected_amount, i) => {
            expect(maker_erc20_balance_after[i] - maker_erc20_balance_before[i]).to.be.eq(expected_amount);
        });

        await Promise.all(maker_lot.erc721.map((token, i) => {
            const id_owner = ethers
                .getContractAt('IERC721', token.toString())
                .then((c) => c.ownerOf(maker_lot.erc721_ids[i]));
            return expect(id_owner).to.eventually.be.eq(maker);
        }));
    }

}