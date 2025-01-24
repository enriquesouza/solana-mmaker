import dotenv from 'dotenv';
import { JupiterClient } from './api/jupiter';
import { setupSolanaConnection } from './api/solana';
import { MarketMaker } from './strategies/basicMM';
import { loadKeypairsFromCsv } from './keypairLoader'; // Load utility function
import { Keypair } from '@solana/web3.js';

dotenv.config();

async function main() {
    if (!process.env.SOLANA_RPC_ENDPOINT) {
        throw new Error('SOLANA_RPC_ENDPOINT is not set');
    }

    const connection = setupSolanaConnection(process.env.SOLANA_RPC_ENDPOINT);
    console.log(`Network: ${connection.rpcEndpoint}`);

    const keypairs = await loadKeypairsFromCsv('./keypairs.csv');

    if (keypairs.length === 0) {
        throw new Error('No keypairs found. Ensure the keypairs.csv file exists and has data.');
    }

    const marketMaker = new MarketMaker();
    const enabled = process.env.ENABLE_TRADING === 'true';

    await Promise.all(
        keypairs.map(async (keypair, index) => {
            try {
                console.log(`Initializing Jupiter client for maker ${index + 1}: ${keypair.publicKey.toBase58()}`);
                const jupiterClient = new JupiterClient(connection, keypair);
                await marketMaker.runMM(jupiterClient, enabled);
                console.log(`MarketMaker ${index + 1} initialized.`);
            } catch (error) {
                console.error(`Error initializing MarketMaker ${index + 1}:`, error);
            }
        })
    );
}

main().catch((err) => console.error(err));