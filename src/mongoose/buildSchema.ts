import { IndexOptions, Schema, SchemaTypeOptions } from 'mongoose';
import { BuildSchema, BuildSchemaOptions, FieldGeneratorFunction, FieldToSchemaMap } from '../database/types';
import {
  Block,
  Field,
  FieldAffectingData,
  fieldAffectsData,
  fieldIsLocalized,
  fieldIsPresentationalOnly,
  NonPresentationalField,
  Tab,
  tabHasName,
  UnnamedTab,
} from '../fields/config/types';

const formatBaseSchema = (field: FieldAffectingData, buildSchemaOptions: BuildSchemaOptions) => {
  const { disableUnique, draftsEnabled, indexSortableFields } = buildSchemaOptions;
  const schema: SchemaTypeOptions<unknown> = {
    unique: (!disableUnique && field.unique) || false,
    required: false,
    index: field.index || (!disableUnique && field.unique) || indexSortableFields || false,
  };

  if ((schema.unique && (field.localized || draftsEnabled))) {
    schema.sparse = true;
  }

  if (field.hidden) {
    schema.hidden = true;
  }

  return schema;
};

const localizeSchema = (entity: NonPresentationalField | Tab, schema, localization) => {
  if (fieldIsLocalized(entity) && localization && Array.isArray(localization.locales)) {
    return {
      type: localization.locales.reduce((localeSchema, locale) => ({
        ...localeSchema,
        [locale]: schema,
      }), {
        _id: false,
      }),
      localized: true,
    };
  }
  return schema;
};

const buildSchema: BuildSchema<Schema> = ({
  config,
  fields: incomingFields,
  options = {},
}) => {
  const { allowIDField, options: schemaOptions } = options;
  let schemaFields = {};
  let fields = incomingFields;

  if (!allowIDField) {
    const idField = fields.find((field) => fieldAffectsData(field) && field.name === 'id');
    if (idField) {
      schemaFields = {
        _id: idField.type === 'number' ? Number : String,
      };
      fields = fields.filter((field) => !(fieldAffectsData(field) && field.name === 'id'));
    }
  }

  const schema = new Schema(schemaFields, schemaOptions);

  fields.forEach((field) => {
    if (!fieldIsPresentationalOnly(field)) {
      const addFieldSchema: FieldGeneratorFunction<Schema, Field> = fieldToSchemaMap[field.type];

      if (addFieldSchema) {
        addFieldSchema({ field, schema, config, options });
      }
    }
  });

  return schema;
};

const fieldToSchemaMap: FieldToSchemaMap<Schema> = {
  number: ({ field, schema, config, options }) => {
    const baseSchema = { ...formatBaseSchema(field, options), type: Number };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  text: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: String };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  email: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: String };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  textarea: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: String };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  richText: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: Schema.Types.Mixed };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  code: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: String };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  json: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: Schema.Types.Mixed };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  point: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema: SchemaTypeOptions<unknown> = {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        required: false,
        default: field.defaultValue || undefined,
      },
    };
    if (options.disableUnique && field.unique && field.localized) {
      baseSchema.coordinates.sparse = true;
    }

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });

    if (field.index === true || field.index === undefined) {
      const indexOptions: IndexOptions = {};
      if (!options.disableUnique && field.unique) {
        indexOptions.sparse = true;
        indexOptions.unique = true;
      }
      if (field.localized && config.localization) {
        config.localization.locales.forEach((locale) => {
          schema.index({ [`${field.name}.${locale}`]: '2dsphere' }, indexOptions);
        });
      } else {
        schema.index({ [field.name]: '2dsphere' }, indexOptions);
      }
    }
  },
  radio: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = {
      ...formatBaseSchema(field, options),
      type: String,
      enum: field.options.map((option) => {
        if (typeof option === 'object') return option.value;
        return option;
      }),
    };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  checkbox: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: Boolean };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  date: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = { ...formatBaseSchema(field, options), type: Date };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  upload: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = {
      ...formatBaseSchema(field, options),
      type: Schema.Types.Mixed,
      ref: field.relationTo,
    };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  relationship: ({
    field,
    schema,
    config,
    options,
  }) => {
    const hasManyRelations = Array.isArray(field.relationTo);
    let schemaToReturn: { [key: string]: any } = {};

    if (field.localized && config.localization) {
      schemaToReturn = {
        type: config.localization.locales.reduce((locales, locale) => {
          let localeSchema: { [key: string]: any } = {};

          if (hasManyRelations) {
            localeSchema = {
              ...formatBaseSchema(field, options),
              type: Schema.Types.Mixed,
              _id: false,
              value: {
                type: Schema.Types.Mixed,
                refPath: `${field.name}.${locale}.relationTo`,
              },
              relationTo: { type: String, enum: field.relationTo },
            };
          } else {
            localeSchema = {
              ...formatBaseSchema(field, options),
              type: Schema.Types.Mixed,
              ref: field.relationTo,
            };
          }

          return {
            ...locales,
            [locale]: field.hasMany ? { type: [localeSchema], default: undefined } : localeSchema,
          };
        }, {}),
        localized: true,
      };
    } else if (hasManyRelations) {
      schemaToReturn = {
        ...formatBaseSchema(field, options),
        type: Schema.Types.Mixed,
        _id: false,
        value: {
          type: Schema.Types.Mixed,
          refPath: `${field.name}.relationTo`,
        },
        relationTo: { type: String, enum: field.relationTo },
      };

      if (field.hasMany) {
        schemaToReturn = {
          type: [schemaToReturn],
          default: undefined,
        };
      }
    } else {
      schemaToReturn = {
        ...formatBaseSchema(field, options),
        type: Schema.Types.Mixed,
        ref: field.relationTo,
      };

      if (field.hasMany) {
        schemaToReturn = {
          type: [schemaToReturn],
          default: undefined,
        };
      }
    }

    schema.add({
      [field.name]: schemaToReturn,
    });
  },
  row: ({
    field,
    schema,
    config,
    options,
  }): void => {
    field.fields.forEach((subField: Field) => {
      const addFieldSchema: FieldGeneratorFunction<Schema, Field> = fieldToSchemaMap[subField.type];

      if (addFieldSchema) {
        addFieldSchema({ field: subField, schema, config, options });
      }
    });
  },
  collapsible: ({
    field,
    schema,
    config,
    options,
  }): void => {
    field.fields.forEach((subField: Field) => {
      const addFieldSchema: FieldGeneratorFunction<Schema, Field> = fieldToSchemaMap[subField.type];

      if (addFieldSchema) {
        addFieldSchema({
          field: subField,
          schema,
          config,
          options,
        });
      }
    });
  },
  tabs: ({
    field,
    schema,
    config,
    options,
  }): void => {
    field.tabs.forEach((tab) => {
      if (tabHasName(tab)) {
        const baseSchema = {
          type: buildSchema({
            config,
            fields: tab.fields,
            options: {
              options: {
                _id: false,
                id: false,
                minimize: false,
              },
              disableUnique: options.disableUnique,
              draftsEnabled: options.draftsEnabled,
            },
          }),
        };

        schema.add({
          [tab.name]: localizeSchema(tab, baseSchema, config.localization),
        });
      } else {
        (tab as UnnamedTab).fields.forEach((subField: Field) => {
          const addFieldSchema: FieldGeneratorFunction<Schema, Field> = fieldToSchemaMap[subField.type];

          if (addFieldSchema) {
            addFieldSchema({
              field: subField,
              schema,
              config,
              options,
            });
          }
        });
      }
    });
  },
  array: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = {
      ...formatBaseSchema(field, options),
      default: undefined,
      type: [buildSchema({
        config,
        fields: field.fields,
        options: {
          options: {
            _id: false,
            id: false,
            minimize: false,
          },
          allowIDField: true,
          disableUnique: options.disableUnique,
          draftsEnabled: options.draftsEnabled,
        },
      })],
    };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  group: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const formattedBaseSchema = formatBaseSchema(field, options);

    const baseSchema = {
      ...formattedBaseSchema,
      type: buildSchema({
        config,
        fields: field.fields,
        options: {
          options: {
            _id: false,
            id: false,
            minimize: false,
          },
          disableUnique: options.disableUnique,
          draftsEnabled: options.draftsEnabled,
        },
      }),
    };

    schema.add({
      [field.name]: localizeSchema(field, baseSchema, config.localization),
    });
  },
  select: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const baseSchema = {
      ...formatBaseSchema(field, options),
      type: String,
      enum: field.options.map((option) => {
        if (typeof option === 'object') return option.value;
        return option;
      }),
    };

    if (options.draftsEnabled || !field.required) {
      baseSchema.enum.push(null);
    }

    schema.add({
      [field.name]: localizeSchema(
        field,
        field.hasMany ? [baseSchema] : baseSchema,
        config.localization,
      ),
    });
  },
  blocks: ({
    field,
    schema,
    config,
    options,
  }): void => {
    const fieldSchema = {
      default: undefined,
      type: [new Schema({}, { _id: false, discriminatorKey: 'blockType' })],
    };

    schema.add({
      [field.name]: localizeSchema(field, fieldSchema, config.localization),
    });

    field.blocks.forEach((blockItem: Block) => {
      const blockSchema = new Schema({}, { _id: false, id: false });

      blockItem.fields.forEach((blockField) => {
        const addFieldSchema: FieldGeneratorFunction<Schema, Field> = fieldToSchemaMap[blockField.type];
        if (addFieldSchema) {
          addFieldSchema({
            field: blockField,
            schema: blockSchema,
            config,
            options,
          });
        }
      });

      if (field.localized && config.localization) {
        config.localization.locales.forEach((locale) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore Possible incorrect typing in mongoose types, this works
          schema.path(`${field.name}.${locale}`).discriminator(blockItem.slug, blockSchema);
        });
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Possible incorrect typing in mongoose types, this works
        schema.path(field.name).discriminator(blockItem.slug, blockSchema);
      }
    });
  },
};

export default buildSchema;
