const axios = require('axios');

const rosettaConfig = {
    online: "",
    offline: "",
}

const initialize = (config) => {
    rosettaConfig.online = config.online;
    rosettaConfig.offline = config.offline;
}

/**
 * Account Coins
 * https://www.rosetta-api.org/docs/AccountApi.html#accountcoins
 */
const accountCoins = async (params) => {
    return axios.post(`${rosettaConfig.online}/account/coins`, params);
}

/**
 * Construction Preprocess
 */
const constructionPreprocess = async (params) => {
    return axios.post(`${rosettaConfig.offline}/construction/preprocess`, params);
}

/**
 * Construction Metadata
 */
const constructionMetadata = async (params) => {
    return axios.post(`${rosettaConfig.online}/construction/metadata`, params);
}

/**
 * Construction Payloads
 */
const constructionPayloads = async (params) => {
    return axios.post(`${rosettaConfig.offline}/construction/payloads`, params);
}

/**
 * Construction Parse
 */
const constructionParse = async (params) => {
    return axios.post(`${rosettaConfig.offline}/construction/parse`, params);
}

/**
 * Construction Combine
 */
 const constructionCombine = async (params) => {
    return axios.post(`${rosettaConfig.offline}/construction/combine`, params);
}

/**
 * Construction Hash
 */
 const constructionHash = async (params) => {
    return axios.post(`${rosettaConfig.offline}/construction/hash`, params);
}

/**
 * Construction Submit
 */
 const constructionSubmit = async (params) => {
    return axios.post(`${rosettaConfig.online}/construction/submit`, params);
}

module.exports = {
    initialize,
    accountCoins,
    constructionPreprocess,
    constructionMetadata,
    constructionPayloads,
    constructionParse,
    constructionCombine,
    constructionHash,
    constructionSubmit,
};