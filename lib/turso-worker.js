const { parentPort, workerData } = require('worker_threads');
const { createClient } = require('@libsql/client');

const shared = new Int32Array(workerData.sharedBuffer);
const client = createClient({
  url: workerData.url,
  authToken: workerData.authToken,
});

function normalize(value) {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  return value;
}

function rowsOf(result) {
  return result.rows.map((row) => {
    const obj = {};
    result.columns.forEach((column, index) => {
      const value = row[column] !== undefined ? row[column] : row[index];
      obj[column] = normalize(value);
    });
    return obj;
  });
}

parentPort.on('message', async (message) => {
  const port = message.port;
  try {
    let result;
    if (message.op === 'exec') {
      await client.executeMultiple(message.sql);
      result = { rows: [], lastInsertRowid: 0, rowsAffected: 0 };
    } else {
      const response = await client.execute({ sql: message.sql, args: message.params || [] });
      result = {
        rows: rowsOf(response),
        lastInsertRowid: normalize(response.lastInsertRowid || 0),
        rowsAffected: response.rowsAffected || 0,
      };
    }
    port.postMessage({ result });
  } catch (err) {
    port.postMessage({ error: err && err.message ? err.message : String(err) });
  } finally {
    Atomics.store(shared, 0, 1);
    Atomics.notify(shared, 0, 1);
  }
});

Atomics.store(shared, 0, 1);
Atomics.notify(shared, 0, 1);
