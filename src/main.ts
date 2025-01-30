import dotenv from 'dotenv';
import { setupSolanaConnection } from './api/solana';
import { MarketMaker } from './strategies/basicMM';

dotenv.config();

async function main() {
    if (!process.env.SOLANA_RPC_ENDPOINT) {
        throw new Error('SOLANA_RPC_ENDPOINT is not set');
    }

    const connection = setupSolanaConnection(process.env.SOLANA_RPC_ENDPOINT);
    console.log(`Connected to Solana network: ${connection.rpcEndpoint}`);

    const enableTrading = process.env.ENABLE_TRADING === 'true';

    const marketMaker = new MarketMaker(connection);
    await marketMaker.runMM(enableTrading); // Runs the market maker
}

main().catch((err) => console.error('Error in main function:', err));