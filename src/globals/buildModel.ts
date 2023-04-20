import mongoose from 'mongoose';
import buildSchema from '../mongoose-adapter/buildSchema';
import { SanitizedConfig } from '../config/types';
import getBuildQueryPlugin from '../mongoose-adapter/buildQuery';
import { GlobalModel } from './config/types';

const buildModel = (config: SanitizedConfig): GlobalModel | null => {
  if (config.globals && config.globals.length > 0) {
    const globalsSchema = new mongoose.Schema({}, { discriminatorKey: 'globalType', timestamps: true, minimize: false });

    globalsSchema.plugin(getBuildQueryPlugin());

    const Globals = mongoose.model('globals', globalsSchema) as unknown as GlobalModel;

    Object.values(config.globals).forEach((globalConfig) => {
      const globalSchema = buildSchema({
        config,
        fields: globalConfig.fields,
        options: {
          options: {
            minimize: false,
          },
        },
      });
      Globals.discriminator(globalConfig.slug, globalSchema);
    });

    return Globals;
  }

  return null;
};

export default buildModel;
