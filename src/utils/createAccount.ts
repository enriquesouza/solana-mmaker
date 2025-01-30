import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
} from '@solana/web3.js';
import {
    Token,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

/**
 * Ensure that the token account exists for the given mint and owner.
 * If it doesn't exist, create it.
 * @param connection - Solana connection object
 * @param payer - Keypair of the payer
 * @param owner - The public key of the token owner
 * @param mint - The public key of the token mint
 * @returns The public key of the associated token account
 */
export async function ensureTokenAccountExists(
    connection: Connection,
    payer: Keypair,
    owner: PublicKey,
    mint: PublicKey
): Promise<PublicKey> {
    const associatedTokenAddress = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID, // Associated Token Program ID
        TOKEN_PROGRAM_ID,           // Token Program ID
        mint,                       // Token mint address
        owner,                      // Owner address
        false                       // allowOwnerOffCurve (default: false)
    );

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    if (!accountInfo) {
        console.log('Creating associated token account...');
        const transaction = new Transaction().add(
            Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                mint,
                associatedTokenAddress,
                owner,
                payer.publicKey
            )
        );

        // Sign and send the transaction
        const signature = await connection.sendTransaction(transaction, [payer]);
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('Token account created:', associatedTokenAddress.toBase58());
    } else {
        console.log('Token account already exists:', associatedTokenAddress.toBase58());
    }

    return associatedTokenAddress;
}