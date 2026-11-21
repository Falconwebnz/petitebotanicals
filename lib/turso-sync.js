const path = require('path');
const { Worker, MessageChannel, receiveMessageOnPort } = require('worker_threads');

function statementCount(sql) {
  return String(sql)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function openTurso(url, authToken) {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(path.join(__dirname, 'turso-worker.js'), {
    workerData: { url, authToken, sharedBuffer: shared.buffer },
  });
  const ready = Atomics.wait(shared, 0, 0, 60000);
  if (ready === 'timed-out') throw new Error('Timed out opening Turso');
  let lastAffected = 0;
  let failure = null;

  worker.on('error', (err) => {
    failure = err;
  });
  worker.on('exit', (code) => {
    if (code !== 0 && !failure) failure = new Error('Turso connection closed (' + code + ')');
  });

  function call(op, sql, params) {
    if (failure) throw failure;
    const { port1, port2 } = new MessageChannel();
    Atomics.store(shared, 0, 0);
    worker.postMessage({ op, sql, params, port: port2 }, [port2]);
    const status = Atomics.wait(shared, 0, 0, 60000);
    if (status === 'timed-out') throw new Error('Timed out waiting for Turso');
    const received = receiveMessageOnPort(port1);
    if (!received) throw new Error('Turso sent no response');
    if (received.message.error) throw new Error(received.message.error);
    return received.message.result;
  }

  return {
    query(sql, params) {
      return call('query', sql, params || []).rows;
    },
    run(sql, params) {
      const args = params || [];
      const result = args.length || statementCount(sql) <= 1
        ? call('query', sql, args)
        : call('exec', sql, []);
      lastAffected = result.rowsAffected || 0;
      return result;
    },
    getRowsModified() {
      return lastAffected;
    },
  };
}

module.exports = { openTurso };
