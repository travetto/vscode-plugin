import * as vscode from 'vscode';

import * as path from 'path';
import { ResultsManager } from './results';
import { TestExecution } from './execution';

import { execSync, spawnSync } from 'child_process';
import { TestExecutionPool } from './execution-pool';
import { TestUtil } from './util';
import { Promises } from '../../../core/promise';
import { Logger } from '../../../core/log';

export class TestRunner {
  static getRunnerConfig(document: vscode.TextDocument, line: number) {

    let title = '';

    const { method, suite } = TestUtil.getCurrentClassMethod(document, line);

    if (method && suite) {
      title = `@Test ${suite.name!.text}.${(method.name as any).text}`;
    } else if (suite) {
      title = `@Suite ${suite.name!.text}`;
    }

    title = `Running ${path.basename(document.fileName)} ${title}`.trim();

    return { title, method, suite };
  }

  private status: vscode.StatusBarItem;

  private dockerNS = `test-${process.pid}`;
  private results = new Map<string, ResultsManager>();
  private pool = new TestExecutionPool();
  private hasDocker = false;

  constructor(private window: typeof vscode.window) {
    process.env.DOCKER_NS = this.dockerNS;

    this.status = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    try {
      this.hasDocker = spawnSync('docker -v', { shell: true }).status === 0;
    } catch { }
  }

  setStatus(message: string, color?: string) {
    if (!message) {
      this.status.hide();
    } else {
      this.status.color = color || '#fff';
      this.status.text = message;
      this.status.show();
    }
  }

  getResults(document: vscode.TextDocument) {
    if (!this.results.has(document.fileName)) {
      const rm = new ResultsManager(document);
      this.results.set(document.fileName, rm);
    }
    return this.results.get(document.fileName)!;
  }

  async run(document: vscode.TextDocument, line: number) {
    const res = this.getResults(document);

    try {
      await this.pool.run(exec => this._run(exec, document, line), res);
    } catch (e) {
      Logger.error('Test', document.fileName, e.message, e);
    }
  }

  async _run(exec: TestExecution, document: vscode.TextDocument, line: number) {
    const canceller = Promises.fromEvent();
    const timeout = Promises.extendableTimeout(20000); // Force 20 sec max between comms

    if (this.getResults(document).hasTotalError()) {
      line = 0;
    }

    const { title, method, suite } = TestRunner.getRunnerConfig(document, line);

    if (!suite) {
      this.getResults(document).resetAll();
    }

    const progressConfig = {
      cancellable: !method,
      title,
      location: method ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification
    };

    try {
      await this.window.withProgress(progressConfig, async (progress, cancel) => {
        if (cancel) {
          cancel.onCancellationRequested(canceller.cancel);
        }

        timeout.extend();

        const run = this._execRun(exec, document, line, x => {
          timeout.extend();
          if (!method) {
            progress.report(x);
          }
        });
        await Promise.race([timeout.promise, canceller.promise, run]);
      });

      const totals = this.getResults(document).getTotals();
      this.setStatus(`Success ${totals.success}, Failed ${totals.failed}`, totals.failed ? '#f33' : '#8f8');
    } catch (e) {
      this.setStatus(`Error has occurred: ${e.message}`, '#f33');
      Logger.error('Test', document.fileName, e.message, e);
      throw e;
    }
  }

  async _execRun(exec: TestExecution, document: vscode.TextDocument, line: number, progress: (input: { message: string }) => void) {
    return exec.run(document.fileName, line, e => {
      if (e.type === 'runComplete') {
        if (e.error) {
          this.getResults(document).resetAll();
          this.getResults(document).setTotalError(e.error);
        }
      } else {
        this.getResults(document).onEvent(e, line);
      }
      const progressTotals = this.getResults(document).getTotals();
      progress({ message: `Tests: Success ${progressTotals.success}, Failed ${progressTotals.failed}` });
    });
  }

  async shutdown() {
    Logger.debug('Test', 'Shutting down');
    if (this.hasDocker) {
      const lines = execSync('docker ps -a').toString().split('\n');
      const ids = lines.filter(x => x.includes(this.dockerNS)).map(x => x.split(' ')[0]);

      if (ids.length) {
        execSync(`docker rm -f ${ids.join(' ')}`);
      }
    }
    await this.pool.shutdown();
  }

  async reinitPool() {
    await this.pool.shutdown();
    await this.pool.init();
  }

  async close(doc: vscode.TextDocument) {
    if (this.results.has(doc.fileName)) {
      this.results.get(doc.fileName)!.removeEditors();
      this.results.get(doc.fileName)!.resetAll();
      this.results.delete(doc.fileName);
    }
  }
}