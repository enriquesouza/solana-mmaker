import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import csvParser from 'csv-parser';
import { loadKeypairsFromCsv } from './keypairLoader';

// Load environment variables
dotenv.config();

// Constants
const RECIPIENTS_CSV = './keypairs.csv'; // CSV file with recipient private keys
const FEE_ESTIMATE = 5000; // Approximate transaction fee in lamports

// Main function to collect SOL
async function collectSol() {
    // Check required environment variables
    if (!process.env.SOLANA_RPC_ENDPOINT) {
        throw new Error('SOLANA_RPC_ENDPOINT is not set');
    }

    if (!process.env.SOLANA_PK) {
        throw new Error('SOLANA_PK is not set.');
    }

    // Initialize Solana connection
    const connection = new Connection(process.env.SOLANA_RPC_ENDPOINT, 'confirmed');
    console.log(`Connected to network: ${connection.rpcEndpoint}`);

    // Load the distributor's keypair
    const privateKeyBase58 = process.env.SOLANA_PK;
    const distributorKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    console.log(`Distributor Public Key: ${distributorKeypair.publicKey.toBase58()}`);

    // Load recipient keypairs
    const recipientKeypairs = await loadKeypairsFromCsv(RECIPIENTS_CSV);
    console.log(`Loaded ${recipientKeypairs.length} recipient keypairs.`);

    for (const recipientKeypair of recipientKeypairs) {
        try {
            const recipientBalance = await connection.getBalance(recipientKeypair.publicKey);

            if (recipientBalance <= FEE_ESTIMATE) {
                console.log(
                    `Skipping ${recipientKeypair.publicKey.toBase58()} due to insufficient balance.`
                );
                continue;
            }

            const amountToSend = recipientBalance - FEE_ESTIMATE;
            console.log(
                `Collecting ${amountToSend / 1e9} SOL from ${recipientKeypair.publicKey.toBase58()}...`
            );

            // Create a transfer transaction
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: recipientKeypair.publicKey,
                    toPubkey: distributorKeypair.publicKey,
                    lamports: amountToSend,
                })
            );

            // Sign and send the transaction
            const signature = await connection.sendTransaction(transaction, [recipientKeypair]);
            console.log(`Transaction successful: ${signature}`);
        } catch (error) {
            console.error(
                `Error processing recipient ${recipientKeypair.publicKey.toBase58()}:`,
                error
            );
        }
    }

    console.log('SOL collection completed.');
}

collectSol().catch((err) => console.error('Error collecting SOL:', err));