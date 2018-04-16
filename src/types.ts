import * as vscode from 'vscode';

export type SMap<v> = { [key: string]: v };

export type Decs<T> = SMap<SMap<T>>;

export interface ResultStsyles {
  [key: string]: vscode.TextEditorDecorationType;
}

export interface Result {
  state: string;
  decoration: vscode.DecorationOptions;
}

export interface ResultState extends Partial<Result> {
  styles: ResultStsyles;
}

export interface TestState extends ResultState {
  assertStyles: ResultStsyles;
  assertions: Result[];
  className: string;
  methodName: string;
}

export interface AllState {
  suite: { [key: string]: ResultState };
  test: { [key: string]: TestState };
}

export interface SuiteConfig {
  className: string;
  lines: { start: number, end: number };
}

export interface SuiteResult extends SuiteConfig {
  skip: number;
  fail: number;
  success: number;
}

export interface TestConfig extends SuiteConfig {
  methodName: string;
}

export interface TestResult extends TestConfig {
  status: 'skip' | 'fail' | 'success';
}

export interface Assertion {
  className: string;
  methodName: string;
  status: 'skip' | 'fail' | 'success';
  error?: Error;
  message?: string;
  line: number;
}

export type TestEvent =
  { phase: 'before', type: 'suite', suite: SuiteConfig } |
  { phase: 'after', type: 'suite', suite: SuiteResult } |
  { phase: 'before', type: 'test', test: TestConfig } |
  { phase: 'after', type: 'test', test: TestResult } |
  { phase: 'after', type: 'assertion', assertion: Assertion };

