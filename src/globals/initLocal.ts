/* eslint-disable no-param-reassign */
import mongoose, { Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';
import getBuildQueryPlugin from '../mongoose-adapter/buildQuery';
import buildModel from './buildModel';
import type { Payload } from '../payload';
import { getVersionsModelName } from '../versions/getVersionsModelName';
import { buildVersionGlobalFields } from '../versions/buildGlobalFields';
import { CollectionModel } from '../collections/config/types';

export default function initGlobalsLocal(payload: Payload): void {
  const { config } = payload;
  if (config.globals) {
    payload.globals = {
      Model: buildModel(config),
      config: config.globals,
    };

    config.globals.forEach((global) => {
      if (global.versions) {
        const versionModelName = getVersionsModelName(global);

        const versionGlobalFields = buildVersionGlobalFields(global);

        const versionSchema = <Schema>payload.database.buildSchema({
          config: payload.config,
          fields: versionGlobalFields,
          options: {
            disableUnique: true,
            draftsEnabled: true,
            options: {
              timestamps: false,
              minimize: false,
            },
          },
        });

        versionSchema.plugin(paginate, { useEstimatedCount: true })
          .plugin(getBuildQueryPlugin({ versionsFields: versionGlobalFields }));

        payload.versions[global.slug] = mongoose.model(versionModelName, versionSchema) as CollectionModel;
      }
    });
  }
}
