import { Keypair } from '@solana/web3.js';
import csvParser from 'csv-parser';
import fs from 'fs';

export async function loadKeypairsFromCsv(filePath: string): Promise<Keypair[]> {
    return new Promise((resolve, reject) => {
        const keypairs: Keypair[] = [];

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
                const { address, private_key } = row;
                const secretKey = Buffer.from(private_key, 'base64');
                keypairs.push(Keypair.fromSecretKey(secretKey));
            })
            .on('end', () => {
                console.log(`Loaded ${keypairs.length} keypairs from ${filePath}`);
                resolve(keypairs);
            })
            .on('error', (err) => reject(err));
    });
}