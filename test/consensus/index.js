/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */

'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brLedger = require('bedrock-ledger');
const crypto = require('crypto');

const api = {};
module.exports = api;

// register this plugin
bedrock.events.on('bedrock.start', callback => {
  brLedger.use({
    capabilityName: 'Continuity2017',
    capabilityValue: {
      type: 'consensus',
      api: api
    }
  }, callback);
});

const blocks = api.blocks = {};

blocks.setConfig = (ledgerNode, configBlock, callback) => {
  async.auto({
    hashBlock: callback => hasher(configBlock, callback),
    writeConfig: ['hashBlock', (results, callback) => {
      // FIXME: hash needs label prefix? (e.g. sha256:)
      const meta = {
        blockHash: results.hashBlock,
        consensus: Date.now()
      };
      const options = {};
      ledgerNode.storage.blocks.add(configBlock, meta, options, callback);
    }]
  }, callback);
};

// FIXME: normalize data
function hasher(data, callback) {
  callback(
    null, crypto.createHash('sha256').update(JSON.stringify(data))
      .digest('hex'));
}
