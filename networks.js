const bitcoin = require('bitgo-utxo-lib');

const hashFunctions = {
    address: bitcoin.crypto.hash256, // sha256x2
    transaction: bitcoin.crypto.hash256 // sha256x2
}
  
const mainnet = {
    messagePrefix: '\x18ZelCash Signed Message:\n',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
    },
    pubKeyHash: 0x1cb8,
    scriptHash: 0x1cbd,
    wif: 0x80,
    // This parameter was introduced in version 3 to allow soft forks, for version 1 and 2 transactions we add a
    // dummy value.
    consensusBranchId: {
        1: 0x00,
        2: 0x00,
        3: 0x5ba81b19,
        4: 0x76b809bb
    },
    coin: bitcoin.coins.ZEC,
    hashFunctions: hashFunctions
};

const testnet = {
    messagePrefix: '\x18ZelCash Signed Message:\n',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394
    },
    pubKeyHash: 0x1d25,
    scriptHash: 0x1cba,
    wif: 0x80,
    // This parameter was introduced in version 3 to allow soft forks, for version 1 and 2 transactions we add a
    // dummy value.
    consensusBranchId: {
        1: 0x00,
        2: 0x00,
        3: 0x5ba81b19,
        4: 0x76b809bb
    },
    coin: bitcoin.coins.ZEC,
    hashFunctions: hashFunctions
};


module.exports = {
    mainnet,
    testnet,
};
