// Sample records shown when the API is unreachable, so every screen stays usable offline.
import type { House } from '@/lib/houses'
import type { Tenant } from '@/lib/tenants'

const tenant = (id: string, fullName: string, phone: string, details: Partial<Tenant> = {}): Tenant => ({
  id: `demo-tenant-${id}`,
  fullName,
  phone,
  altPhone: '',
  nationalId: '',
  email: '',
  occupation: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  status: 'ACTIVE',
  ...details,
})

export const demoTenants: Tenant[] = [
  tenant('1', 'John Kamau', '0712 445 890', { altPhone: '0701 234 567', nationalId: '12345678', email: 'john.kamau@example.com', occupation: 'Software engineer', emergencyContactName: 'Mary Kamau', emergencyContactPhone: '0723 456 789' }),
  tenant('2', 'Mary Wanjiku', '0722 138 421', { nationalId: '23456789', email: 'mary.wanjiku@example.com', occupation: 'Accountant', emergencyContactName: 'Peter Wanjiku', emergencyContactPhone: '0711 223 344' }),
  tenant('3', 'Peter Mwangi', '0701 882 734', { nationalId: '29384756', occupation: 'Teacher' }),
  tenant('4', 'Jane Njeri', '0798 224 117', { nationalId: '31122334', email: 'jane.njeri@example.com', occupation: 'Pharmacist' }),
  tenant('5', 'Lucy Akinyi', '0744 601 938', { nationalId: '33445566', occupation: 'Designer', emergencyContactName: 'Tom Akinyi', emergencyContactPhone: '0700 556 677' }),
  tenant('6', 'Grace Muthoni', '0733 556 677', { nationalId: '45678901', email: 'grace.muthoni@example.com', occupation: 'Nurse', emergencyContactName: 'Paul Muthoni', emergencyContactPhone: '0722 998 877' }),
  tenant('7', 'David Ochieng', '0718 905 642', { nationalId: '34567890', email: 'david.ochieng@example.com', occupation: 'Business owner', status: 'FORMER' }),
]

const house = (unitNumber: string, houseType: string, rent: number, status: House['status'], tenant: House['tenant'] = null): House => ({
  id: `demo-${unitNumber}`,
  propertyId: 'demo-property',
  unitNumber,
  houseType,
  waterMeterNumber: `WM-${unitNumber}`,
  electricityMeterNumber: `EM-${unitNumber}`,
  defaultMonthlyRent: rent,
  defaultDepositAmount: rent,
  notes: '',
  status,
  tenant,
  metadata: {},
})

export const demoHouses: House[] = [
  house('H01', '1 Bedroom', 15000, 'OCCUPIED', { name: 'John Kamau', phone: '0712 445 890' }),
  house('H02', '1 Bedroom', 15000, 'OCCUPIED', { name: 'Mary Wanjiku', phone: '0722 138 421' }),
  house('H03', '1 Bedroom', 15000, 'NOTICE_GIVEN', { name: 'Peter Mwangi', phone: '0701 882 734' }),
  house('H04', '2 Bedroom', 18000, 'OCCUPIED', { name: 'Jane Njeri', phone: '0798 224 117' }),
  house('H05', '2 Bedroom', 17000, 'VACANT'),
  house('H06', '1 Bedroom', 15000, 'OCCUPIED', { name: 'Lucy Akinyi', phone: '0744 601 938' }),
  house('H07', 'Bedsitter', 10000, 'RESERVED'),
  house('H08', 'Studio', 12000, 'MAINTENANCE'),
]
