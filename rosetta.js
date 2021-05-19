const rosettaClient = require('./rosettaClient');
const bitcoin = require('bitgo-utxo-lib');

var NETWORK_IDENTIFIER = {};
var CURRENCY = {};

const setNetwork = (network) => {
    NETWORK_IDENTIFIER = network;
}

const setCurrency = (currency) => {
    CURRENCY = currency;
}

// pulled from https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
const operationsEqual = (x, y) => {
  if (x === y) return true

  if (!(x instanceof Object) || !(y instanceof Object)) return false

  if (x.constructor !== y.constructor) return false

  for (const p in x) {
    if (!x.hasOwnProperty(p)) continue

    if (!y.hasOwnProperty(p)) return false

    if (x[p] === y[p]) continue

    if (typeof x[p] !== 'object') return false

    if (!operationsEqual(x[p], y[p])) return false
  }

  for (const p in y) if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) return false

  return true
}

const calculateOperationValue = (ops) => {
    const totalOpsAmount = ops.reduce((amount, input) => {
      amount += input.amount ? Math.abs(+input.amount?.value) : 0
      return amount
    }, 0)
    return totalOpsAmount
  }
  
  const createOps = (params) => {
  
    const { amount, coins } = params
    const fee = parseInt(params.fee)
    const satAmount = (amount ? amount * (10**8): 0)
    const inputs = coins.reduce((inputs, coin, index) => {
      const totalInputsAmount = calculateOperationValue(inputs)
  
      if (inputs.length < 1 || totalInputsAmount < (satAmount + fee)) {
        const input = {
          operation_identifier: {
            index: index,
            network_index: index,
          },
          type: 'INPUT',
          account: {
            address: params.userAddress,
          },
          amount: {
            value: `-${coin.amount.value}`,
            currency: {
              symbol: coin.amount.currency.symbol,
              decimals: 8,
            },
          },
          coin_change: {
            coin_action: 'coin_spent',
            coin_identifier: coin.coin_identifier,
          },
        }
        inputs.push(input)
      }
      return inputs
  
    }, [])
    const totalInputsAmount = calculateOperationValue(inputs)
    const ops = [
      ...inputs,
      {
        operation_identifier: {
          index: inputs.length,
          network_index: inputs.length,
        },
        type: 'OUTPUT',
        account: {
          address: params.recipient,
        },
        amount: {
          value: `${satAmount}`,
          currency: CURRENCY,
        },
      },
      {
        operation_identifier: {
          index: inputs.length + 1,
          network_index: inputs.length + 1,
        },
        type: 'OUTPUT',
        account: {
          address: params.userAddress,
        },
        amount: {
          value: `${+totalInputsAmount - satAmount - fee}`,
          currency: CURRENCY,
        },
      },
    ]
    return ops
  }

/**
 * Fetch Account Coins
 * https://www.rosetta-api.org/docs/AccountApi.html#accountcoins
 */
const fetchAccountCoins = async (userAddress) => {
  if (userAddress.length > 0) {
    try {
      const accountCoinsResponse = await rosettaClient.accountCoins({
        network_identifier: NETWORK_IDENTIFIER,
        account_identifier: {
          address: userAddress
        },
        include_mempool: false
      })
      return accountCoinsResponse.data.coins
    } catch (error) {
      return Promise.reject(error)
    }
  } else {
    return Promise.reject('No user address found')
  }
}


/**
 * Preprocess
 * @param ops
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructionpreprocess
 */
const constructionPreprocess = async (ops) => {
    try {
      const preprocessResponse = await rosettaClient.constructionPreprocess({
        network_identifier: NETWORK_IDENTIFIER,
        operations: ops,
      })
      return preprocessResponse.data
    } catch (error) {
      throw Promise.reject(error)
    }
  }

/**
 * Construction Metadata
 * @param preprocessRes 
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructionmetadata
 */
const constructionMetadata = async (preprocessRes) => {
  try {
    const metadataResponse = await rosettaClient.constructionMetadata({
      network_identifier: NETWORK_IDENTIFIER,
      options: preprocessRes.options ?? {},
    })
    return metadataResponse.data
  } catch (error) {
    throw Promise.reject(error)
  }
}

/**
 * Construction Paylods
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructionpayloads
 */
 const constructionPayloads = async (params) => {
  try {
    const { metadataRes, operations } = params
    const body = {
      network_identifier: NETWORK_IDENTIFIER,
      metadata: metadataRes.metadata,
      operations: operations,
    }
    const payloadsResponse = await rosettaClient.constructionPayloads(body)
    return payloadsResponse.data
  } catch (error) {
    throw Promise.reject(error)
  }
}

/**
 * Construction Parse
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructionparse
 */
 const constructionParse = async (params) => {
  try {
    const { signed, transaction } = params
    const body = {
      network_identifier: NETWORK_IDENTIFIER,
      signed: signed,
      transaction: transaction,
    }
    const parseResponse =  await rosettaClient.constructionParse(body)
    return parseResponse.data
  } catch (error) {
    throw Promise.reject(error)
  }
}

/**
 * Construction Combine
 * @param payloadsRes 
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructioncombine
 */
 const constructionCombine = async (params) => {
  try {
    const kpPubKey = params.keyPair.publicKey || params.keyPair.getPublicKeyBuffer()
    const signatures = params.payloadResponse.payloads.map((payload) => ({
      hex_bytes: params.keyPair.sign(Buffer.from(payload.hex_bytes, 'hex')).toScriptSignature(bitcoin.Transaction.SIGHASH_ALL).toString('hex'),
      signing_payload: payload,
      public_key: {
        hex_bytes: kpPubKey.toString('hex'),
        curve_type: 'secp256k1',
      },
      signature_type: 'ecdsa',
    }))

    const combineBody = {
      network_identifier: NETWORK_IDENTIFIER,
      unsigned_transaction: params.payloadResponse.unsigned_transaction,
      signatures: signatures
    }

    const combineResponse = await rosettaClient.constructionCombine(combineBody)
    return combineResponse.data
  } catch (error) {
    throw Promise.reject(error)
  }
}

/**
 * Construction Hash
 * @param signedTx 
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructionhash
 */
 const constructionHash = async (signedTx) => {
  try {
    const body = {
      network_identifier: NETWORK_IDENTIFIER,
      signed_transaction: signedTx,
    }
    const hashResponse = await rosettaClient.constructionHash(body)
    return hashResponse.data
  } catch (error) {
    throw Promise.reject(error)
  }
}

/**
 * Construction Submit
 * @param signedTx 
 * https://www.rosetta-api.org/docs/ConstructionApi.html#constructionsubmit
 */
 const constructionSubmit = async (signedTx) => {
  try {
    const body = {
      network_identifier: NETWORK_IDENTIFIER,
      signed_transaction: signedTx,
    }
    const submitResponse = await rosettaClient.constructionSubmit(body)
    return submitResponse.data
  } catch (error) {
    throw Promise.reject(error)
  }
}

module.exports = {
    setNetwork,
    setCurrency,
    operationsEqual,
    createOps,
    fetchAccountCoins,
    constructionPreprocess,
    constructionMetadata,
    constructionPayloads,
    constructionParse,
    constructionCombine,
    constructionHash,
    constructionSubmit,
};