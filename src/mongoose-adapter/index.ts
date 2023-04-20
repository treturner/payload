import { Schema } from 'mongoose';
import { DatabaseAdapter } from '../database/types';
import buildSchema from './buildSchema';

export const mongooseAdapter: DatabaseAdapter<Schema> = {
  buildSchema,
};
