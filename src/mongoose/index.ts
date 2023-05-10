import { Schema } from 'mongoose';
import { DatabaseAdapter } from '../database/types';
import buildSchema from './buildSchema';
import { buildSortParam } from './buildSortParam';

export const mongooseAdapter: DatabaseAdapter<Schema> = {
  buildSchema,
  buildSortParam,
};
