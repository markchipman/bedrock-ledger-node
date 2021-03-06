/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const jsonld = bedrock.jsonld;
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

jsigs.use('jsonld', jsonld);

let signedConfig;

describe('Operations API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => jsigs.sign(mockData.ledgerConfiguration, {
        algorithm: 'RsaSignature2018',
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      }, (err, result) => {
        signedConfig = result;
        callback(err);
      })
    ], done);
  });
  beforeEach(done => {
    helpers.removeCollections('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    let ledgerNode;
    before(done => {
      async.auto({
        getActor: callback =>
          brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
            actor = result;
            callback(err);
          }),
        addLedger: ['getActor', (results, callback) => brLedgerNode.add(
          actor, {ledgerConfiguration: signedConfig}, (err, result) => {
            ledgerNode = result;
            callback(err);
          })]
      }, done);
    });
    it('should add operation', done => {
      const testOperation = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'CreateWebLedgerRecord',
        record: {
          '@context': 'https://schema.org/',
          value: uuid()
        }
      };
      async.auto({
        sign: callback => jsigs.sign(testOperation, {
          algorithm: 'RsaSignature2018',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
        }, callback),
        add: ['sign', (results, callback) => {
          ledgerNode.operations.add({operation: results.sign}, err => {
            assertNoError(err);
            callback();
          });
        }]
      }, done);
    });
    it('should get event containing the operation', done => {
      const testOperation = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'CreateWebLedgerRecord',
        record: {
          '@context': 'https://schema.org/',
          value: uuid()
        }
      };
      async.auto({
        sign: callback => jsigs.sign(testOperation, {
          algorithm: 'RsaSignature2018',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
        }, callback),
        add: ['sign', (results, callback) =>
          ledgerNode.operations.add({operation: results.sign}, callback)],
        // unilateral consensus allows immediate retrieval of an event with
        // a single operation in it from the latest block
        get: ['add', (results, callback) => {
          ledgerNode.blocks.getLatest((err, result) => {
            assertNoError(err);
            should.exist(result);
            should.exist(result.eventBlock);
            should.exist(result.eventBlock.block);
            should.exist(result.eventBlock.block.event);
            const event = result.eventBlock.block.event[0];
            should.exist(event);
            should.exist(event.operation);
            should.exist(event.operation[0]);
            event.operation[0].should.deep.equal(results.sign);
            callback();
          });
        }]
      }, done);
    });
  });
});
