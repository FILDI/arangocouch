'use strict';

const EventEmitter = require('events');

const url = require('url');
const http = require('request-easy').http;
const isString = require('lodash.isstring');
const https = require('request-easy').https;

const mapTextToType = {
  'insert/update': 2300,
  delete: 2302,
};

const mapTypeToText = new Map([
  [2300, 'insert/update'],
  [2302, 'delete'],
]);

class ArangoCouch extends EventEmitter {
  constructor(opts) {
    super();

    const adbUrl = url.parse(isString(opts) ? opts : url.format(opts));

    this.req = new (adbUrl.protocol === 'https:' ? https : http)(adbUrl);

    const db = '/' === adbUrl.pathname ? '/_system' : adbUrl.pathname;

    this._loggerStatePath = `/_db${db}/_api/replication/logger-state`;
    this._loggerFollowPath = `/_db${db}/_api/replication/logger-follow`;

    this.collectionsMap = new Map();
    this._stopped = false;
  }

  start() {
    this._stopped = false;
    this._startLoggerState();
  }

  stop() {
    this._stopped = true;
  }

  _startLoggerState() {
    this.req.get({ path: this._loggerStatePath }, (status, headers, body) => {
      if (200 !== status) {
        this.emit('error', new Error('E_LOGGERSTATE'), status, headers, body);
        this.stop();
        return;
      } // if

      body = JSON.parse(body);

      let lastLogTick = body.state.lastLogTick;
      let start = 0;
      let idx = 0;

      let type = 0;
      let tid = 0;
      let entry;

      const txns = new Map();

      const handleEntry = () => {
        const colName = entry.cname;

        const colConf = this.collectionsMap.get(colName);

        if (undefined === colConf) return;

        const events = colConf.get('events');

        if (0 !== events.size && !events.has(type)) return;

        const key = entry.data._key;
        const keys = colConf.get('keys');

        if (0 !== keys.size && !keys.has(key)) return;

        this.emit(colName, entry.data, mapTypeToText.get(type));
      };

      const ticktock = () => {
        if (this._stopped) return;

        this.req.get(
          { path: `${this._loggerFollowPath}?from=${lastLogTick}` },
          (status, headers, body) => {
            if (204 < status || 0 === status) {
              this.emit(
                'error',
                new Error('E_LOGGERFOLLOW'),
                status,
                headers,
                body,
              );
              this.stop();
              return;
            } // if

            lastLogTick = headers['x-arango-replication-lasttick'];

            if ('0' === headers['x-arango-replication-lastincluded']) {
              return setTimeout(ticktock, 500);
            } // if

            start = idx = 0;
            while (true) {
              idx = body.indexOf('\n', start);
              if (-1 === idx) break;

              entry = JSON.parse(body.slice(start, idx));
              start = idx + 1;

              type = entry.type;

              tid = entry.tid;

              if (2200 === type) {
                // txn start
                txns.set(tid, new Set());
              } else if (2201 === type) {
                // txn commit and replay docs
                for (const data of txns.get(tid)) {
                  [type, entry] = data;
                  handleEntry();
                } // for
                txns.delete(tid);
              } else if (2002 === type) {
                // txn abort
                txns.delete(tid);
              } else {
                if (2300 !== type && 2302 !== type) continue;

                if ('0' !== tid) {
                  txns.get(tid).add([type, entry]);
                  continue;
                } // if

                handleEntry();
              } // else
            } // while
            ticktock();
          },
        );
      };
      ticktock();
    });
  }

  subscribe(confs) {
    if ('string' === typeof confs) confs = { collection: confs };
    if (!Array.isArray(confs)) confs = [confs];

    for (const conf of confs) {
      let colConfMap = undefined;
      if (this.collectionsMap.has(conf.collection)) {
        colConfMap = this.collectionsMap.get(conf.collection);
      } else {
        colConfMap = new Map([
          ['events', new Set()],
          ['keys', new Set()],
        ]);
        this.collectionsMap.set(conf.collection, colConfMap);
      }

      if (conf.events) {
        for (const event of conf.events) {
          colConfMap.get('events').add(mapTextToType[event]);
        } // for
      } // if
      if (conf.keys) {
        for (const key of conf.keys) {
          colConfMap.get('keys').add(key);
        } // for
      } // if
    } // for
  } // subscribe()

  unsubscribe(confs) {
    if ('string' === typeof confs) confs = { collection: confs };
    if (!Array.isArray(confs)) confs = [confs];

    for (const conf of confs) {
      if (conf.events) {
        const events = this.collectionsMap.get(conf.collection).get('events');
        for (const event of conf.events) {
          events.delete(mapTextToType[event]);
        } // for
      } // if
      if (conf.keys) {
        const keys = this.collectionsMap.get(conf.collection).get('keys');
        for (const key of conf.keys) {
          keys.delete(key);
        } // for
      } // if

      if (!conf.events && !conf.keys) {
        this.collectionsMap.delete(conf.collection);
      } // if
    } // for
  } // unsubscribe()
}

module.exports = ArangoCouch;
