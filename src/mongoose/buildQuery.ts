/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import deepmerge from 'deepmerge';
import mongoose, { FilterQuery, Schema } from 'mongoose';
import { combineMerge } from '../utilities/combineMerge';
import { getSchemaTypeOptions } from './getSchemaTypeOptions';
import { operatorMap } from './operatorMap';
import { sanitizeQueryValue } from './sanitizeFormattedValue';
import type { BuildQueryArgs, CollectionModel, SanitizedCollectionConfig } from '../collections/config/types';
import type { PayloadRequest } from '../express/types';
import type { SanitizedConfig } from '../config/types';
import { SanitizedGlobalConfig } from '../globals/config/types';
import { CollectionPermission, GlobalPermission } from '../../auth';
import { getEntityPolicies } from '../utilities/getEntityPolicies';

const validOperators = ['like', 'contains', 'in', 'all', 'not_in', 'greater_than_equal', 'greater_than', 'less_than_equal', 'less_than', 'not_equals', 'equals', 'exists', 'near'];

const subQueryOptions = {
  limit: 50,
  lean: true,
};

type ParseType = {
  searchParams?:
  {
    [key: string]: any;
  };
  sort?: boolean;
};

type PathToQuery = {
  complete: boolean
  path: string
  Model: CollectionModel
  config: SanitizedCollectionConfig | SanitizedGlobalConfig
}

type SearchParam = {
  path?: string,
  value: unknown,
}

type ParamParserArgs = {
  model
  req: PayloadRequest
  rawParams: unknown
  type: 'collection' | 'global'
  entity: SanitizedCollectionConfig | SanitizedGlobalConfig
  overrideAccess?: boolean
  queryHiddenFields?: boolean
}
class ParamParser implements ParamParserArgs {
  query: {
    searchParams: {
      [key: string]: any;
    };
    sort: boolean;
  };

  constructor({
    model,
    entity,
    type,
    req,
    rawParams,
    overrideAccess,
    queryHiddenFields,
  }: ParamParserArgs) {
    this.parse = this.parse.bind(this);
    this.model = model;
    this.entity = entity;
    this.type = type;
    this.req = req;
    this.config = req.payload.config;
    this.rawParams = rawParams;
    this.overrideAccess = overrideAccess;
    this.queryHiddenFields = queryHiddenFields;
    this.query = {
      searchParams: {},
      sort: false,
    };
  }

  model: ParamParserArgs['model'];

  req: ParamParserArgs['req'];

  config: SanitizedConfig;

  rawParams: ParamParserArgs['rawParams'];

  type: ParamParserArgs['type']

  entity: ParamParserArgs['entity']

  overrideAccess: ParamParserArgs['overrideAccess']

  queryHiddenFields: ParamParserArgs['queryHiddenFields']

  policies: Record<string, [CollectionPermission | GlobalPermission, Promise<void>[]]>

  error: unknown

  // Entry point to the ParamParser class
  async parse(): Promise<ParseType> {
    if (typeof this.rawParams === 'object') {
      this.policies = {
        [this.entity.slug]: getEntityPolicies({
          req: this.req,
          entity: this.entity,
          operations: ['read'],
          type: this.type,
        }),
      };
      for (const key of Object.keys(this.rawParams)) {
        if (key === 'where') {
          this.query.searchParams = await this.parsePathOrRelation(this.policies[this.entity.slug], 'where' in this.rawParams && this.rawParams.where);
        } else if (key === 'sort') {
          const [policy, promises] = this.policies[this.entity.slug];
          await Promise.all(promises);
          // only sort on a field that has read accesss
          if (policy.fields[key].read.permission) {
            this.query.sort = this.rawParams[key];
          }
        }
      }
      return this.query;
    }
    return {};
  }

  async parsePathOrRelation(policy, object) {
    let result = {} as FilterQuery<any>;
    // We need to determine if the whereKey is an AND, OR, or a schema path
    for (const relationOrPath of Object.keys(object)) {
      if (relationOrPath.toLowerCase() === 'and') {
        const andConditions = object[relationOrPath];
        const builtAndConditions = await this.buildAndOrConditions(policy, andConditions);
        if (builtAndConditions.length > 0) result.$and = builtAndConditions;
      } else if (relationOrPath.toLowerCase() === 'or' && Array.isArray(object[relationOrPath])) {
        const orConditions = object[relationOrPath];
        const builtOrConditions = await this.buildAndOrConditions(policy, orConditions);
        if (builtOrConditions.length > 0) result.$or = builtOrConditions;
      } else {
        // It's a path - and there can be multiple comparisons on a single path.
        // For example - title like 'test' and title not equal to 'tester'
        // So we need to loop on keys again here to handle each operator independently
        const pathOperators = object[relationOrPath];
        if (typeof pathOperators === 'object') {
          for (const operator of Object.keys(pathOperators)) {
            if (validOperators.includes(operator)) {
              const searchParam = await this.buildSearchParam(this.model.schema, relationOrPath, pathOperators[operator], operator);

              if (searchParam?.value && searchParam?.path) {
                result = {
                  ...result,
                  [searchParam.path]: searchParam.value,
                };
              } else if (typeof searchParam?.value === 'object') {
                result = deepmerge(result, searchParam.value, { arrayMerge: combineMerge });
              }
            }
          }
        }
      }
    }
    return result;
  }

  async buildAndOrConditions(policy, conditions) {
    const completedConditions = [];
    // Loop over all AND / OR operations and add them to the AND / OR query param
    // Operations should come through as an array
    for (const condition of conditions) {
      // If the operation is properly formatted as an object
      if (typeof condition === 'object') {
        const result = await this.parsePathOrRelation(policy, condition);
        if (Object.keys(result).length > 0) {
          completedConditions.push(result);
        }
      }
    }
    return completedConditions;
  }

  // Build up an array of auto-localized paths to search on
  // Multiple paths may be possible if searching on properties of relationship fields

  async getLocalizedPaths(config: SanitizedCollectionConfig | SanitizedGlobalConfig, Model: CollectionModel, incomingPath: string, operator): Promise<PathToQuery[]> {
    const { schema } = Model;
    const [policy, promises] = this.policies[config.slug];
    await Promise.all(promises);
    const pathSegments = incomingPath.split('.');

    let paths: PathToQuery[] = [
      {
        path: '',
        complete: false,
        Model,
        config,
      },
    ];

    const segmentPromises = pathSegments.map(async (segment, i) => {
      const lastIncompletePath = paths.find(({ complete }) => !complete);
      const { path } = lastIncompletePath;

      const currentPath = path ? `${path}.${segment}` : segment;
      const currentSchemaType = schema.path(currentPath);
      const currentSchemaPathType = schema.pathType(currentPath);

      if (currentSchemaPathType === 'nested') {
        lastIncompletePath.path = currentPath;
        return true;
      }

      const upcomingSegment = pathSegments[i + 1];

      if (!this.overrideAccess) {
        if (currentSchemaPathType === 'adhocOrUndefined' && path !== currentPath && currentSchemaType?.options?.relationTo?.enum) {
          let hasPolicy = false;
          const allPromises = currentSchemaType.options.relationTo.enum.map((slug) => {
            if (!this.policies[slug]) {
              this.policies[slug] = getEntityPolicies({
                req: this.req,
                entity: this.req.payload.collections[slug].config,
                operations: ['read'],
                type: 'collection',
              });
            }
            return this.policies[slug][1];
          });
          await Promise.all(allPromises);

          currentSchemaType.options.relationTo.enum.forEach((slug) => {
            const [policyRelation] = this.policies[slug];
            if (policyRelation.fields[segment] && policyRelation.fields[segment].read.permission) {
              hasPolicy = true;
            }
          });

          // relationship.value is allowed for populating multi-relationship docs
          // TODO: discover a better way to identify relationship.value
          if (!hasPolicy && !currentPath.endsWith('.value')) {
            this.error = `Unknown property in query: "${currentPath}"`;
            return false;
          }
        } else if (currentPath !== '_id' && ((currentSchemaPathType === 'real' && !upcomingSegment) || (currentSchemaPathType === 'adhocOrUndefined' && segment === currentPath)) && (!policy.fields?.[currentPath] || policy.fields?.[currentPath].read.permission === false)) {
          // throw the same error for non-existing fields and permission errors for security
          this.error = `Unknown property in query: "${currentPath}"`;
          return false;
        }
      }

      if (currentSchemaType && currentSchemaPathType !== 'adhocOrUndefined') {
        const currentSchemaTypeOptions = getSchemaTypeOptions(currentSchemaType);

        if (currentSchemaTypeOptions.localized) {
          const upcomingLocalizedPath = `${currentPath}.${upcomingSegment}`;
          const upcomingSchemaTypeWithLocale = schema.path(upcomingLocalizedPath);

          if (upcomingSchemaTypeWithLocale) {
            lastIncompletePath.path = currentPath;
            return true;
          }

          const localePath = `${currentPath}.${this.req.locale}`;
          const localizedSchemaType = schema.path(localePath);

          if (localizedSchemaType || operator === 'near') {
            lastIncompletePath.path = localePath;
            return true;
          }
        }

        lastIncompletePath.path = currentPath;
        return true;
      }

      const priorSchemaType = schema.path(path);

      if (priorSchemaType) {
        const priorSchemaTypeOptions = getSchemaTypeOptions(priorSchemaType);
        if (typeof priorSchemaTypeOptions.ref === 'string') {
          const RefModel = mongoose.model(priorSchemaTypeOptions.ref) as any;
          const refConfig = this.req.payload.collections[priorSchemaTypeOptions.ref].config;
          if (!this.policies[priorSchemaTypeOptions.ref]) {
            this.policies[priorSchemaTypeOptions.ref] = getEntityPolicies({
              req: this.req,
              entity: refConfig,
              operations: ['read'],
              type: 'collection',
            });
          }

          lastIncompletePath.complete = true;

          const remainingPath = pathSegments.slice(i).join('.');

          paths = [
            ...paths,
            ...await this.getLocalizedPaths(this.req.payload.collections[priorSchemaTypeOptions.ref].config as unknown as SanitizedCollectionConfig, RefModel, remainingPath, operator),
          ];

          return false;
        }
      }

      if (operator === 'near' || currentSchemaPathType === 'adhocOrUndefined') {
        lastIncompletePath.path = currentPath;
      }

      return true;
    });
    await Promise.all(segmentPromises);
    return paths;
  }

  // Convert the Payload key / value / operator into a MongoDB query
  async buildSearchParam(schema, incomingPath, val, operator): Promise<SearchParam> {
    // Replace GraphQL nested field double underscore formatting
    let sanitizedPath = incomingPath.replace(/__/gi, '.');
    if (sanitizedPath === 'id') sanitizedPath = '_id';

    const collectionPaths = await this.getLocalizedPaths(this.entity, this.model, sanitizedPath, operator);
    const [{ path }] = collectionPaths;

    if (path) {
      const schemaType = schema.path(path);
      const schemaOptions = getSchemaTypeOptions(schemaType);
      const formattedValue = sanitizeQueryValue(schemaType, path, operator, val);

      if (!this.queryHiddenFields && (['salt', 'hash'].includes(path) || schemaType?.options?.hidden)) {
        return undefined;
      }

      // If there are multiple collections to search through,
      // Recursively build up a list of query constraints
      if (collectionPaths.length > 1) {
        // Remove top collection and reverse array
        // to work backwards from top
        const collectionPathsToSearch = collectionPaths.slice(1).reverse();

        const initialRelationshipQuery = {
          value: {},
        } as SearchParam;

        const relationshipQuery = collectionPathsToSearch.reduce(async (priorQuery, {
          config: subEntity,
          Model: SubModel,
          path: subPath,
        }, i) => {
          const priorQueryResult = await priorQuery;

          // On the "deepest" collection,
          // Search on the value passed through the query
          if (i === 0) {
            const [subQuery, subQueryError] = await SubModel.buildQuery({
              req: this.req,
              type: 'collection',
              entity: subEntity,
              query: {
                [subPath]: {
                  [operator]: val,
                },
              },
              overrideAccess: true,
            });
            if (subQueryError) {
              this.error = subQueryError;
              return { path, value: {} };
            }

            const result = await SubModel.find(subQuery, subQueryOptions);

            const $in = result.map((doc) => doc._id.toString());

            if (collectionPathsToSearch.length === 1) {
              return { path, value: { $in } };
            }

            const nextSubPath = collectionPathsToSearch[i + 1].path;

            return {
              value: { [nextSubPath]: { $in } },
            };
          }

          const subQuery = priorQueryResult.value;
          const result = await SubModel.find(subQuery, subQueryOptions);

          const $in = result.map((doc) => doc._id.toString());

          // If it is the last recursion
          // then pass through the search param
          if (i + 1 === collectionPathsToSearch.length) {
            return { path, value: { $in } };
          }

          return {
            value: {
              _id: { $in },
            },
          };
        }, Promise.resolve(initialRelationshipQuery));

        return relationshipQuery;
      }

      if (operator && validOperators.includes(operator)) {
        const operatorKey = operatorMap[operator];

        let overrideQuery = false;
        let query;

        // If there is a ref, this is a relationship or upload field
        // IDs can be either string, number, or ObjectID
        // So we need to build an `or` query for all these types
        if (schemaOptions && (schemaOptions.ref || schemaOptions.refPath)) {
          overrideQuery = true;

          query = {
            $or: [
              {
                [path]: {
                  [operatorKey]: formattedValue,
                },
              },
            ],
          };

          if (typeof formattedValue === 'number' || (typeof formattedValue === 'string' && mongoose.Types.ObjectId.isValid(formattedValue))) {
            query.$or.push({
              [path]: {
                [operatorKey]: formattedValue.toString(),
              },
            });
          }

          if (typeof formattedValue === 'string') {
            if (!Number.isNaN(formattedValue)) {
              query.$or.push({
                [path]: {
                  [operatorKey]: parseFloat(formattedValue),
                },
              });
            }
          }
        }

        // If forced query
        if (overrideQuery) {
          return {
            value: query,
          };
        }

        // Some operators like 'near' need to define a full query
        // so if there is no operator key, just return the value
        if (!operatorKey) {
          return {
            path,
            value: formattedValue,
          };
        }

        return {
          path,
          value: { [operatorKey]: formattedValue },
        };
      }
    }
    return undefined;
  }
}

// This plugin asynchronously builds a list of Mongoose query constraints
// which can then be used in subsequent Mongoose queries.
function buildQueryPlugin(schema: Schema): void {
  async function buildQuery({
    req,
    query,
    type,
    entity,
    overrideAccess,
    queryHiddenFields = false,
  }: BuildQueryArgs) {
    const paramParser = new ParamParser({
      model: this,
      req,
      rawParams: query,
      type,
      entity,
      overrideAccess,
      queryHiddenFields,
    });
    const params = await paramParser.parse();
    return [params.searchParams, paramParser.error];
  }
  // eslint-disable-next-line no-param-reassign
  schema.statics.buildQuery = buildQuery;
}
export default buildQueryPlugin;
