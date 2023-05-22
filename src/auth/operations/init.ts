import { CollectionModel } from '../../collections/config/types';
import { PayloadRequest } from '../../express/types';

async function init(args: { Model: CollectionModel, req: PayloadRequest }): Promise<boolean> {
  const {
    Model,
  } = args;

  // TODO: use payload.db.findOne instead of countDocuments
  const count = await Model.countDocuments({});

  return count >= 1;
}

export default init;
