import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import csvParser from 'csv-parser';

// Load environment variables
dotenv.config();

// Constants
const RECIPIENTS_CSV = './keypairs.csv'; // CSV file with recipient addresses
const FEE_ESTIMATE = 5000; // Approximate transaction fee in lamports

// Load recipient addresses from a CSV file
async function loadRecipientAddresses(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const addresses: string[] = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => addresses.push(row.address))
            .on('end', () => resolve(addresses))
            .on('error', (err) => reject(err));
    });
}

// Main function to distribute SOL
async function distributeSol() {
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
    const userKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    console.log(`Distributor Public Key: ${userKeypair.publicKey.toBase58()}`);

    // Load recipient addresses
    const recipients = await loadRecipientAddresses(RECIPIENTS_CSV);
    console.log(`Loaded ${recipients.length} recipient addresses.`);

    // Fetch distributor's SOL balance
    const distributorBalance = await connection.getBalance(userKeypair.publicKey);
    console.log(`Distributor's total SOL balance: ${distributorBalance / 1e9} SOL`);

    if (recipients.length === 0) {
        throw new Error('No recipients found. Please provide a valid CSV file.');
    }

    // Calculate amount to send per recipient
    const amountPerRecipient = Math.floor(distributorBalance / recipients.length);
    console.log(`Each recipient will receive: ${amountPerRecipient / 1e9} SOL`);

    // Ensure there's enough balance for fees
    if (amountPerRecipient <= FEE_ESTIMATE) {
        throw new Error('Insufficient balance to distribute after accounting for fees.');
    }

    for (const recipientAddress of recipients) {
        try {
            const recipient = new PublicKey(recipientAddress);

            // Create a transfer transaction
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: userKeypair.publicKey,
                    toPubkey: recipient,
                    lamports: amountPerRecipient - FEE_ESTIMATE, // Subtract estimated fee
                })
            );

            // Sign and send the transaction
            console.log(`Sending ${amountPerRecipient / 1e9} SOL to ${recipient.toBase58()}...`);
            const signature = await connection.sendTransaction(transaction, [userKeypair]);
            console.log(`Transaction successful: ${signature}`);
        } catch (error) {
            console.error(`Error processing recipient ${recipientAddress}:`, error);
        }
    }

    console.log('SOL distribution completed.');
}

distributeSol().catch((err) => console.error('Error distributing SOL:', err));