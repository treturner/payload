import { Schema } from 'mongoose';
import { DatabaseAdapter } from '../database/types';
import init from './init';

export const mongooseAdapter: DatabaseAdapter<Schema> = {
  init,
};
