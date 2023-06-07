import type { Access, FieldAccess } from 'payload/types'

import { checkUserRoles } from '../../utilities/checkUserRoles'
import { checkTenantRoles } from '../utilities/checkTenantRoles'

export const tenantAdmins: Access = ({ req: { user } }) => {
  return (
    checkUserRoles(['super-admin'], user) ||
    user?.tenants?.some(({ tenant }) => {
      const id = typeof tenant === 'string' ? tenant : tenant?.id
      return checkTenantRoles(['admin'], user, id)
    })
  )
}

export const tenantAdminsFieldAccess: FieldAccess = args => {
  const {
    req: { user },
    doc,
  } = args

  return (
    checkUserRoles(['super-admin'], user) ||
    doc?.tenants?.some(({ tenant }) => {
      const id = typeof tenant === 'string' ? tenant : tenant?.id
      return checkTenantRoles(['admin'], user, id)
    })
  )
}
