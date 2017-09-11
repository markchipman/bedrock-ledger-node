/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const _ = require('lodash');
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

let signedConfigEvent;

describe('State Machine API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => jsigs.sign(mockData.events.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      }, (err, result) => {
        signedConfigEvent = result;
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
        addLedger: ['getActor', (results, callback) => {
          brLedgerNode.add(actor, {configEvent: signedConfigEvent},
            (err, result) => {
            ledgerNode = result;
            callback(err);
          });
        }]
      }, done);
    });
    it('should get existing event input from state machine', done => {
      const event = _.cloneDeep(mockData.events.beta);
      async.auto({
        sign: callback => {
          event.id = 'https://example.com/events/' + uuid();
          jsigs.sign(event, {
            algorithm: 'LinkedDataSignature2015',
            privateKeyPem: mockData.groups.authorized.privateKey,
            creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
          }, (err, result) => callback(err, result));
        },
        add: ['sign', (results, callback) => ledgerNode.events.add(
          results.sign, (err, result) => callback(err, result))
        ],
        get: ['add', (results, callback) => {
          const objId = 'https://example.com/events/1234567';
          ledgerNode.stateMachine.get(objId, {}, (err, result) => {
            should.not.exist(err);
            should.exist(result);
            result.object.should.deep.equal(results.sign.input[0]);
            callback();
          });
        }]
      }, done);
    });
  });
});
