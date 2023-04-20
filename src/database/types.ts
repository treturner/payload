import { SchemaOptions } from 'mongoose';
import { SanitizedConfig } from '../config/types';
import {
  ArrayField,
  BlockField,
  CheckboxField,
  CodeField,
  CollapsibleField,
  DateField,
  EmailField,
  Field,
  GroupField,
  JSONField,
  NumberField,
  PointField,
  RadioField,
  RelationshipField,
  RichTextField,
  RowField,
  SelectField,
  TabsField,
  TextareaField,
  TextField,
  UploadField,
} from '../fields/config/types';

export interface DatabaseAdapter<TSchema> {
  buildSchema: BuildSchema<TSchema>
}

export type BuildSchema<TSchema> = (args: {
  config: SanitizedConfig,
  fields: Field[],
  options: BuildSchemaOptions,
}) => TSchema

export type BuildSchemaOptions = {
  options?: SchemaOptions
  allowIDField?: boolean
  disableUnique?: boolean
  draftsEnabled?: boolean
  indexSortableFields?: boolean
}

export type PaginatedDocs<T = any> = {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page?: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage?: number | null | undefined
  nextPage?: number | null | undefined
}

/**
 * Field config types that need representation in the database
 */
type FieldType = 'number'
  | 'text'
  | 'email'
  | 'textarea'
  | 'richText'
  | 'code'
  | 'json'
  | 'point'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'upload'
  | 'relationship'
  | 'row'
  | 'collapsible'
  | 'tabs'
  | 'array'
  | 'group'
  | 'select'
  | 'blocks'

export type FieldGeneratorFunction<TSchema, TField extends Field> = (args: FieldGenerator<TSchema, TField>) => void

/**
 * Object mapping types to a schema based on TSchema
 */
export type FieldToSchemaMap<TSchema> = {
  number: FieldGeneratorFunction<TSchema, NumberField>
  text: FieldGeneratorFunction<TSchema, TextField>
  email: FieldGeneratorFunction<TSchema, EmailField>
  textarea: FieldGeneratorFunction<TSchema, TextareaField>
  richText: FieldGeneratorFunction<TSchema, RichTextField>
  code: FieldGeneratorFunction<TSchema, CodeField>
  json: FieldGeneratorFunction<TSchema, JSONField>
  point: FieldGeneratorFunction<TSchema, PointField>
  radio: FieldGeneratorFunction<TSchema, RadioField>
  checkbox: FieldGeneratorFunction<TSchema, CheckboxField>
  date: FieldGeneratorFunction<TSchema, DateField>
  upload: FieldGeneratorFunction<TSchema, UploadField>
  relationship: FieldGeneratorFunction<TSchema, RelationshipField>
  row: FieldGeneratorFunction<TSchema, RowField>
  collapsible: FieldGeneratorFunction<TSchema, CollapsibleField>
  tabs: FieldGeneratorFunction<TSchema, TabsField>
  array: FieldGeneratorFunction<TSchema, ArrayField>
  group: FieldGeneratorFunction<TSchema, GroupField>
  select: FieldGeneratorFunction<TSchema, SelectField>
  blocks: FieldGeneratorFunction<TSchema, BlockField>
}

export type FieldGenerator<TSchema, TField> = {
  field: TField,
  schema: TSchema,
  config: SanitizedConfig,
  options: BuildSchemaOptions,
}
