import paginate from 'mongoose-paginate-v2';
import { Schema } from 'mongoose';
import type { Payload } from '../payload';
import getBuildQueryPlugin from '../mongoose/buildQuery';
import { SanitizedCollectionConfig } from './config/types';

type Args = {
  payload: Payload
  collection: SanitizedCollectionConfig
  schemaOptions?: Record<string, Schema>
}
const buildCollectionSchema = ({ payload, collection, schemaOptions = {} }: Args): Schema => {
  const schema = <Schema>payload.database.buildSchema({
    config: payload.config,
    fields: collection.fields,
    options: {
      draftsEnabled: Boolean(typeof collection?.versions === 'object' && collection.versions.drafts),
      options: {
        timestamps: collection.timestamps !== false,
        minimize: false,
        ...schemaOptions,
      },
      indexSortableFields: payload.config.indexSortableFields,
    },
  });

  if (payload.config.indexSortableFields && collection.timestamps !== false) {
    schema.index({ updatedAt: 1 });
    schema.index({ createdAt: 1 });
  }
  if (collection.indexes) {
    collection.indexes.forEach((index) => {
      schema.index(index.fields, index.options);
    });
  }
  schema.plugin(paginate, { useEstimatedCount: true })
    .plugin(getBuildQueryPlugin({ collectionSlug: collection.slug }));

  return schema;
};

export default buildCollectionSchema;
