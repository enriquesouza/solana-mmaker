import { JupiterClient } from '../api/jupiter';
import { SOL_MINT_ADDRESS, PECA_MINT_ADDRESS, USDC_MINT_ADDRESS } from '../constants/constants';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import Decimal from 'decimal.js';
import { fromNumberToLamports } from '../utils/convert';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { sleep } from '../utils/sleep';
import { loadKeypairsFromCsv } from '../keypairLoader';

/**
 * Class for market making basic strategy
 */
export class MarketMaker {
    mcbToken: { address: string; symbol: string; decimals: number };
    solToken: { address: string; symbol: string; decimals: number };
    usdcToken: { address: string; symbol: string; decimals: number };
    waitTime: number;
    slippageBps: number;
    priceTolerance: number;
    rebalancePercentage: number;
    connection: Connection;

    /**
     * Initializes a new instance of the MarketMaker class with default properties.
     * @param connection Solana connection object
     */
    constructor(connection: Connection) {
        this.connection = connection;

        // Define token metadata
        this.mcbToken = { address: PECA_MINT_ADDRESS, symbol: 'PECA', decimals: 6 };
        this.solToken = { address: SOL_MINT_ADDRESS, symbol: 'SOL', decimals: 9 };
        this.usdcToken = { address: USDC_MINT_ADDRESS, symbol: 'USDC', decimals: 6 };

        // Define market-making parameters
        this.waitTime = 60000 * 5; // 5 minutes
        this.slippageBps = 50; // 0.3%
        this.priceTolerance = 0.02; // 2%
        this.rebalancePercentage = 0.5; // 50%
    }

    /**
     * Run market making strategy
     * Loads keypairs and processes them sequentially to avoid rate limits.
     * @param enableTrading Whether trading is enabled.
     * @returns Promise<void>
     */
    async runMM(enableTrading: boolean = false): Promise<void> {
        console.log('Loading keypairs...');
        const keypairs = await loadKeypairsFromCsv('./keypairs.csv');

        if (keypairs.length === 0) {
            throw new Error('No keypairs found. Please check the keypairs.csv file.');
        }

        console.log(`Starting market makers for ${keypairs.length} keypairs...`);

        while (true) {
            for (const [index, keypair] of keypairs.entries()) {
                try {
                    const jupiterClient = new JupiterClient(this.connection, keypair);
                    console.log(`Processing MarketMaker ${index + 1} for account: ${keypair.publicKey.toBase58()}`);

                    const tradePairs = [{ token0: this.solToken, token1: this.mcbToken }];

                    for (const pair of tradePairs) {
                        await this.evaluateAndExecuteTrade(jupiterClient, pair, enableTrading);
                    }

                    // Sleep after processing each keypair to avoid rate limits
                    console.log(`Waiting 2 seconds before processing the next maker...`);
                    await sleep(2000); // 2 seconds between keypairs
                } catch (err) {
                    console.error(`Error with MarketMaker ${index + 1}:`, err);
                }
            }

            // Global wait time before repeating the loop
            // console.log(`Waiting ${this.waitTime / 1000} seconds before the next round...`);
            // await sleep(this.waitTime);
        }
    }

    /**
     * Evaluate and execute a forced trade.
     * @param jupiterClient JupiterClient object.
     * @param pair Trade pair object.
     * @param enableTrading Whether trading is enabled.
     */
    async evaluateAndExecuteTrade(
        jupiterClient: JupiterClient,
        pair: { token0: any; token1: any },
        enableTrading: boolean
    ): Promise<void> {
        let token0Balance = await this.fetchTokenBalance(jupiterClient, pair.token0); // SOL balance

        console.log(`Previous token0 balance (${pair.token0.symbol}): ${token0Balance}`);

        token0Balance = token0Balance.sub(new Decimal(0.01)); // Subtract a small amount to avoid rounding errors
        const token1Balance = await this.fetchTokenBalance(jupiterClient, pair.token1); // PECA balance

        console.log(`Token0 balance (${pair.token0.symbol}): ${token0Balance}`);
        console.log(`Token1 balance (${pair.token1.symbol}): ${token1Balance}`);

        // ---------------------------------------------
        // 1) Sell ALL PECA -> SOL if there's PECA
        // ---------------------------------------------
        if (token1Balance.gt(0)) {
            console.log(`Forcing trade: Selling ${token1Balance} PECA for SOL...`);
            const lamportsAsString = fromNumberToLamports(
                token1Balance.toNumber(),
                pair.token1.decimals
            ).toString();

            const quote = await jupiterClient.getQuote(pair.token1.address, pair.token0.address, lamportsAsString, this.slippageBps);
            const swapTransaction = await jupiterClient.getSwapTransaction(quote);

            if (enableTrading) {
                const txId = await jupiterClient.executeSwap(swapTransaction);
                console.log(`Swap executed. Transaction ID: ${txId}`);
            } else {
                console.log('Trading disabled.');
            }
        }
        // ---------------------------------------------
        // 2) Else if there's SOL, buy PECA with ALL SOL
        // ---------------------------------------------
        else if (token0Balance.gt(0)) {
            console.log(`Forcing trade: Buying PECA with ${token0Balance} SOL...`);
            const lamportsAsString = fromNumberToLamports(
                token0Balance.toNumber(),
                pair.token0.decimals
            ).toString();

            const quote = await jupiterClient.getQuote(pair.token0.address, pair.token1.address, lamportsAsString, this.slippageBps);
            const swapTransaction = await jupiterClient.getSwapTransaction(quote);

            if (enableTrading) {
                const txId = await jupiterClient.executeSwap(swapTransaction);
                console.log(`Swap executed. Transaction ID: ${txId}`);
            } else {
                console.log('Trading disabled.');
            }
        }
        // ---------------------------------------------
        // 3) Otherwise, no tokens to trade
        // ---------------------------------------------
        else {
            console.log('No tokens available to trade.');
        }
    }

    async fetchTokenBalance(jupiterClient: JupiterClient, token: any): Promise<Decimal> {
        const connection = jupiterClient.getConnection();
        const publicKey = jupiterClient.getUserKeypair().publicKey;

        let balance =
            token.address === SOL_MINT_ADDRESS
                ? await connection.getBalance(publicKey)
                : await this.getSPLTokenBalance(connection, publicKey, new PublicKey(token.address));

        return new Decimal(balance).div(new Decimal(10).pow(token.decimals));
    }

    async getSPLTokenBalance(connection: Connection, walletAddress: PublicKey, tokenMintAddress: PublicKey): Promise<Decimal> {
        const accounts = await connection.getParsedTokenAccountsByOwner(walletAddress, { programId: TOKEN_PROGRAM_ID });
        const accountInfo = accounts.value.find((account: any) => account.account.data.parsed.info.mint === tokenMintAddress.toBase58());
        return accountInfo ? new Decimal(accountInfo.account.data.parsed.info.tokenAmount.amount) : new Decimal(0);
    }

    async getUSDValue(jupiterClient: JupiterClient, token: any): Promise<Decimal> {
        const quote = await jupiterClient.getQuote(token.address, this.usdcToken.address, fromNumberToLamports(1, token.decimals).toString(), this.slippageBps);
        return new Decimal(quote.outAmount).div(new Decimal(10).pow(this.usdcToken.decimals));
    }
}