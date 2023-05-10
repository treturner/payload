import { getLocalizedSortProperty } from './getLocalizedSortProperty';
import { BuildSortParam } from '../database/types';


export const buildSortParam: BuildSortParam = ({ sort, config, fields, timestamps, locale }) => {
  let sortProperty: string;
  let sortOrder = 'desc';

  if (!sort) {
    if (timestamps) {
      sortProperty = 'createdAt';
    } else {
      sortProperty = '_id';
    }
  } else if (sort.indexOf('-') === 0) {
    sortProperty = sort.substring(1);
  } else {
    sortProperty = sort;
    sortOrder = 'asc';
  }

  if (sortProperty === 'id') {
    sortProperty = '_id';
  } else {
    sortProperty = getLocalizedSortProperty({
      segments: sortProperty.split('.'),
      config,
      fields,
      locale,
    });
  }

  return {
    sortProperty,
    sortOrder,
  };
};
