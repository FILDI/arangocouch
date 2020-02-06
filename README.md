# arangocouch

`arangocouch` is a fork of [arangochair](https://github.com/baslr/arangochair) but since there were issues with the project and PRs attempting to fix thme were not reviewed we've created `arangocouch`.

Currently this repo includes the fix for making authenticated requests to arangodb.

## install

```bash
npm install --save FILDI/arangocouch#master
```

## quick example

```es6
const Arangocouch = require("arangocouch");

const defaultMonitor = new Arangocouch("http://127.0.0.1:8529/"); // ArangoDB node to monitor

const monitorWithDB = new Arangocouch("http://127.0.0.1:8529/myDb"); // ArangoDB node to monitor, with database name

const monitorWithAuth = new Arangocouch({
  port: 8529,
  path: "/myDb",
  protocol: "http",
  auth: "user:password",
  hostname: "localhost"
});

defaultMonitor.subscribe({ collection: "users" });

defaultMonitor.start();

defaultMonitor.on("users", (doc, type) => {
  // do something awesome
  // doc:Buffer
  // type:'insert/update'|'delete'
});

defaultMonitor.on("error", (err, httpStatus, headers, body) => {
  // arangocouch stops on errors
  // check last http request
  defaultMonitor.start();
});
```

## subscribe

```es6
// subscribe to all events in the users collection
defaultMonitor.subscribe("users");

// explicit
defaultMonitor.subscribe({
  collection: "users",
  events: ["insert/update", "delete"]
});

// subscribe the users collection with only the delete event
defaultMonitor.subscribe({ collection: "users", events: ["delete"] });

// subscribe the users collection with only the delete event on key myKey
defaultMonitor.subscribe({
  collection: "users",
  events: ["delete"],
  keys: ["myKey"]
});
```

## unsubscribe

```es6
// unsubscribe the users collection
defaultMonitor.unsubscribe("users");

// unsubscribe the delete event in the users collection
defaultMonitor.unsubscribe({ collection: "users", events: ["delete"] });

// unsubscribe the key myKey in the users collection
defaultMonitor.unsubscribe({ collection: "users", keys: ["myKey"] });
```
