import type { CollectionConfig } from 'payload/types'

import { superAdminFieldAccess } from '../access/superAdmins'
import { adminsAndSelf } from './access/adminsAndSelf'
import { tenantAdmins, tenantAdminsFieldAccess } from './access/tenantAdmins'
import { loginAfterCreate } from './hooks/loginAfterCreate'
import { recordLastLoggedInTenant } from './hooks/recordLastLoggedInTenant'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: adminsAndSelf,
    create: tenantAdmins,
    update: adminsAndSelf,
    delete: adminsAndSelf,
  },
  hooks: {
    afterChange: [loginAfterCreate],
    afterLogin: [recordLastLoggedInTenant],
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
    },
    {
      name: 'lastName',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      access: {
        create: superAdminFieldAccess,
        update: superAdminFieldAccess,
        read: superAdminFieldAccess,
      },
      options: [
        {
          label: 'Super Admin',
          value: 'super-admin',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
    },
    {
      name: 'tenants',
      type: 'array',
      label: 'Tenants',
      access: {
        create: tenantAdminsFieldAccess,
        update: tenantAdminsFieldAccess,
        read: tenantAdminsFieldAccess,
      },
      fields: [
        {
          name: 'tenant',
          type: 'relationship',
          relationTo: 'tenants',
          required: true,
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          required: true,
          options: [
            {
              label: 'Admin',
              value: 'admin',
            },
            {
              label: 'User',
              value: 'user',
            },
          ],
        },
      ],
    },
    {
      name: 'lastLoggedInTenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      access: {
        create: () => false,
        read: tenantAdminsFieldAccess,
        update: superAdminFieldAccess,
      },
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
