import { ParamConfig } from '../../../core/types';

export interface Application {
  name: string;
  filename: string;
  params: ParamConfig[];
  id: string;
  appRoot: string;
  description?: string;
  watchable?: boolean;
  env: string;
}

export type AppChoice = Application & {
  inputs: string[],
  time?: number,
  key?: string
};