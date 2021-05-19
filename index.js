const axios = require('axios');
const bitcoin = require('bitgo-utxo-lib');
const rosettaClient = require('./rosettaClient');
const rosetta = require('./rosetta');

/**
 * If necessary, create a file called "config.js" in the root of this project,
 * looking a little like this:
 * 
 * const networks = require('./networks');
 *
 * module.exports = {
 *   submit: false,                                   // set to 'true' to submit the final Rosetta transaction
 *   network: networks.mainnet,                       // mainnet or testnet
 *   sendFrom: "t1VSLqiciCSoNYsMfzPRwoLYGGaD8iyupnV", // source of funds
 *   sendFromPK: "",                                  // private key of source address
 *   sendAmount: 0.5,                                 // number of coins to send
 *   sendFees: 0.0005,                                // At the moment, Rosetta always returns this for fees (if this changes the bitgo & Rosetta txs may not match...)
 *   sendTo: "t1UuVtqkTDQVVp5VGwVC2A4zNimSf3Cxcxo",   // destination address
 *   rosettaOnline: "",                               // URL of Rosetta Online server
 *   rosettaOffline: "",                              // URL of Rosetta Offline server
 * }
 * 
 * This file should not be added to version control, because PRIVATE KEY :)
 */
const config = require('./config');

/**
 * Create a transaction using the tried and trusted 'bitgo-utxo-lib' library
 */
const createBitGoTransaction = async () => {
    console.log(config);
    const transaction = new bitcoin.TransactionBuilder(config.network);
    transaction.setVersion(4, true);
    transaction.setVersionGroupId(parseInt("0x892f2085", 16));

    const utxos = await axios.get(`https://explorer.runonflux.io/api/addr/${config.sendFrom}/utxo`);

    var total = 0;
    var history = [];
    for (var i=0;i<utxos.data.length;i++) {
        const utxo = utxos.data[i];
        transaction.addInput(utxo.txid, utxo.vout);
        history.push({satoshis: utxo.satoshis})
        total += utxo.satoshis;
        if (total > (config.sendAmount+config.sendFees)*1e8) {
            break;
        }
    }

    // Add destination address
    transaction.addOutput(config.sendTo, config.sendAmount*1e8);
    // Add a change address
    transaction.addOutput(config.sendFrom, Math.floor(total - config.sendAmount*1e8 - config.sendFees*1e8));

    // Sign the transaction
    var keyPair = bitcoin.ECPair.fromWIF(config.sendFromPK, config.network)
    const hashType = bitcoin.Transaction.SIGHASH_ALL
    for (let i = 0; i < transaction.inputs.length; i++) {
        transaction.sign(i, keyPair, null, hashType, history[i].satoshis);
    }

    const result = transaction.build();
    return result.toHex();
}

/**
 * Create the same transaction using our fancy-pants Rosetta implementation
 */
const createRosettaTransaction = async () => {
    const accountCoins = await rosetta.fetchAccountCoins(config.sendFrom);

    if (!accountCoins || (accountCoins && accountCoins.length < 1)) {
        return Promise.reject('no account coins found')
    }

    const preprocessOps = rosetta.createOps({fee: 0, 
                                             amount: config.sendAmount,
                                             userAddress: config.sendFrom,
                                             recipient: config.sendTo,
                                             coins: accountCoins})

    const preprocessResponse = await rosetta.constructionPreprocess(preprocessOps);

    const metadataResponse = await rosetta.constructionMetadata(preprocessResponse);

    if (!metadataResponse.suggested_fee || metadataResponse.suggested_fee.length < 1 ) {
        return Promise.reject('no suggested fee found')
    }

    /**
     * Rebuild operations with suggested fee
     */
    const ops = rosetta.createOps({fee: metadataResponse.suggested_fee[0].value,
                                   coins: accountCoins,
                                   amount: config.sendAmount,
                                   userAddress: config.sendFrom,
                                   recipient: config.sendTo})

    /**
     * Construct Payloads to sign
     */
    const payloads = await rosetta.constructionPayloads({operations: ops, 
                                                         metadataRes: metadataResponse})

    /**
     * Parse Unsigned to confirm correctness
     */
    const parsedUnsigned = await rosetta.constructionParse({signed: false,
                                                            transaction: payloads.unsigned_transaction})

    /**
     * Check unsigned operations from construction parse match the intent
     */
    if (!rosetta.operationsEqual(parsedUnsigned.operations, ops)) {
      return Promise.reject('Unsigned Parsed Operations do not match')
    }

    /**
     * Combine
     */
    const combine = await rosetta.constructionCombine({payloadResponse: payloads,
                                                       keyPair: bitcoin.ECPair.fromWIF(config.sendFromPK, config.network)})

    /**
     * Parse Signed Tx to confirm correctness
     */
    const parsedSigned = await rosetta.constructionParse({signed: true,
                                                          transaction: combine.signed_transaction})
 
    /**
     * Check signed operations from construction parse match the intent
     */
    if (!rosetta.operationsEqual(parsedSigned.operations, ops)) {
      return Promise.reject('Signed Parsed Operations do not match')
    }

    const tx = Buffer.from(combine.signed_transaction, 'hex');
    const decodedTx = JSON.parse(tx.toString());
  
    const signedTransaction = decodedTx.transaction;
    return {signed: signedTransaction,
            combineResponse: combine}
}

/**
 * 
 */
const submitRosettaTransaction = async (tx) => {
    /**
     * Get Hash of Signed Tx
     */
     const hashResponse = await rosetta.constructionHash(tx.signed_transaction)
     console.log(hashResponse);
 
    /**
     * Submit Transaction
     */
    const submitResponse = await rosetta.constructionSubmit(tx.signed_transaction)
    console.log(submitResponse);

    if (submitResponse.transaction_identifier.hash !== hashResponse.transaction_identifier.hash) {
      return Promise.reject(
        'Submitted transaction identifier does not match Construction Hash transaction identifier',
      )
    }

    return submitResponse.transaction_identifier.hash;
 }

const run = async() => {
    const bitgoTX = await createBitGoTransaction();

    // Initialize the Rosetta client
    rosettaClient.initialize({
        online: config.rosettaOnline,
        offline: config.rosettaOffline,
    });
    rosetta.setNetwork({
        blockchain: "flux",
        network: "mainnet",
    });
    rosetta.setCurrency({
        symbol: "FLUX",
        decimals: 8,
    });
    const rosettaTX = await createRosettaTransaction();

    if (bitgoTX === rosettaTX.signed) {
        console.log("Yay they match!");
        if (config.submit) {
            const txHash = await submitRosettaTransaction(rosettaTX.combineResponse);
            console.log(`Transaction submitted: ${txHash}`);
        }
    } else {
        console.log(bitgoTX);
        console.log(rosettaTX);
    }
}

run();