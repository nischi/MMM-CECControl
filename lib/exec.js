'use strict';

/* MMM-CECControl — command execution helpers
 *
 * Two flavours:
 *   execFile(file, args, opts)  — structured, no shell. Preferred (cec-ctl, wlr-randr).
 *   execShell(command, opts)    — runs through a shell. Only for legacy/custom commands
 *                                 that rely on pipes (cec-client) or user-supplied strings.
 *
 * Both resolve with { stdout, stderr } and reject on a non-zero exit.
 */

const { execFile: nodeExecFile, exec: nodeExec } = require('child_process');

const DEFAULT_TIMEOUT_MS = 15000;

function execFile(file, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    nodeExecFile(
      file,
      args,
      { timeout: DEFAULT_TIMEOUT_MS, ...opts },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

function execShell(command, opts = {}) {
  return new Promise((resolve, reject) => {
    nodeExec(
      command,
      { timeout: DEFAULT_TIMEOUT_MS, ...opts },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

module.exports = { execFile, execShell, DEFAULT_TIMEOUT_MS };
