import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { log, CWD, channel, } from './util';
import * as spawn from 'cross-spawn';

function logit(str: NodeJS.ReadableStream) {
  str.on('data', (b: Buffer) => channel.append(b.toString()));
  return str;
}

const EXIT = Symbol('EXIT');

export class TestExecution {
  private proc: ChildProcess;
  private waitForKill: Promise<any>;
  private procHandle: Promise<any>;

  listenOnce(type: string) {
    return new Promise(resolve => this.proc.on('message', (e: any) => {
      if (e.type === type) {
        resolve();
      }
    }));
  }

  async _init() {
    try {
      this.proc = spawn(`node_modules/.bin/travetto-test`, [], {
        cwd: CWD,
        env: {
          EXECUTION: true,
          PATH: process.env.PATH
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      if (process.env.DEBUG) {
        logit(this.proc.stdout);
        logit(this.proc.stderr);
      }

      this.waitForKill = new Promise((_, reject) => {
        for (const k of ['error', 'close', 'exit']) {
          this.proc.on(k, (...args) => {
            console.log(k, args);
            delete this.proc;
            reject(EXIT);
          });
        }
      });

      await this.listenOnce('ready');
      log('Ready, lets init');
      this.proc.send({ type: 'init' });
      await this.listenOnce('initComplete');
      log('Init Complete');
    } catch (e) {
      log(`Error: ${e.message}`, e);
    }
  }

  init() {
    if (!this.procHandle) {
      this.procHandle = this._init();
    }
    return this.procHandle;
  }

  async run(file: string, line: number, handler: (e) => void) {
    await this.init();

    this.proc.on('message', handler);

    try {
      log('Running', file);
      this.proc.send({ type: 'run', file, class: line });

      await Promise.race([this.waitForKill, this.listenOnce('runComplete')]);
      log('Run Complete', file);
    } catch (e) {
      if (e !== EXIT) {
        log(e.message, e);
      }
    }

    if (this.proc) {
      this.proc.removeAllListeners();
    }
  }

  kill() {
    if (this.proc) {
      this.proc.removeAllListeners();
      this.proc.kill('SIGKILL');
      delete this.proc;
    }
  }

  release() {
    this.proc.removeAllListeners();
  }

  get active() {
    return !!this.proc;
  }
}