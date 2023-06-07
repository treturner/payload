import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
})

import { buildConfig } from 'payload/config'

import { Pages } from './collections/Pages'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { TenantDropdown } from './components/tenant-dropdown'

export default buildConfig({
  collections: [Users, Tenants, Pages],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  admin: {
    components: {
      beforeNavLinks: [TenantDropdown],
    },
  },
})
