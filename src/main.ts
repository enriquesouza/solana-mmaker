import dotenv from 'dotenv';
import { JupiterClient } from './api/jupiter';
import { setupSolanaConnection } from './api/solana';
import { MarketMaker } from './strategies/basicMM';
import { loadKeypair } from './wallet';
import { Keypair } from '@solana/web3.js';
// Ensure the private key is set in the environment variable
import bs58 from 'bs58';

async function main() {
    dotenv.config();

    if (!process.env.SOLANA_RPC_ENDPOINT) {
        throw new Error('SOLANA_RPC_ENDPOINT is not set');
    }

    if (!process.env.USER_KEYPAIR) {
        throw new Error('USER_KEYPAIR is not set');
    }

    if (!process.env.ENABLE_TRADING) {
        console.warn('ENABLE_TRADING is not set. Defaulting to false');
    }

    const connection = setupSolanaConnection(process.env.SOLANA_RPC_ENDPOINT);
    console.log(`Network: ${connection.rpcEndpoint}`);

    const privateKeyBase58 = process.env.SOLANA_PK;

    if (!privateKeyBase58) {
        throw new Error('SOLANA_PK environment variable is missing.');
    }

    const userKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));

    console.log('Public Key:', userKeypair.publicKey.toBase58());

    console.log('MarketMaker PubKey:', userKeypair.publicKey.toBase58());
    const jupiterClient = new JupiterClient(connection, userKeypair);

    const enabled = process.env.ENABLE_TRADING === 'true';
    const marketMaker = new MarketMaker();
    await marketMaker.runMM(jupiterClient, enabled);
}


main().catch((err) => console.error(err))