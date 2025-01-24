
import { Keypair } from '@solana/web3.js';
import * as path from 'path';
import * as csvWriter from 'csv-writer';

// File path for the CSV
const OUTPUT_CSV_PATH = path.join(__dirname, 'keypairs.csv');

// Generate 100 keypairs and save to a CSV file
async function generateKeypairs() {
    const keypairs = [];

    for (let i = 0; i < 100; i++) {
        const keypair = Keypair.generate();
        const privateKeyBase58 = Buffer.from(keypair.secretKey).toString('base64');
        const address = keypair.publicKey.toBase58();

        keypairs.push({ address, private_key: privateKeyBase58 });
    }

    const csv = csvWriter.createObjectCsvWriter({
        path: OUTPUT_CSV_PATH,
        header: [
            { id: 'address', title: 'Address' },
            { id: 'private_key', title: 'Private Key' }
        ]
    });

    await csv.writeRecords(keypairs);
    console.log(`Generated 100 keypairs and saved to ${OUTPUT_CSV_PATH}`);
}

generateKeypairs().catch((err) => console.error(err));