import type { AddressDetails, ProfileDocument } from '@/lib/employee-profile'

export type { AddressDetails }

export interface ProfileUser {
  id: string
  name: string
  email: string
  role: string
  phoneNumber: string | null
  address: string | null
  profilePicture: string | null
  gender: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  currentAddress: AddressDetails
  permanentAddress: AddressDetails
}

export interface ProfileManager {
  id: string
  user: {
    id: string
    name: string
    email: string
    phoneNumber: string | null
  }
}

export interface ProfileDepartmentHead {
  id: string
  name: string
  email: string
  phoneNumber: string | null
}

export interface ProfileEmployee {
  id: string
  employeeCode: string
  joinDate: string | Date | null
  dateOfBirth: string | Date | null
  designation: string | null
  status: string
  panNumber: string | null
  aadharNumber: string | null
  uanNumber: string | null
  aadharDocUrl: string | null
  panDocUrl: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  bankName: string | null
  bankBranch: string | null
  upiId: string | null
  bloodGroup: string | null
  employmentType: string | null
  workLocation: string | null
  department: {
    id: string
    name: string
    description: string | null
    head: ProfileDepartmentHead | null
  } | null
  manager: ProfileManager | null
}

export interface ProfileData {
  user: ProfileUser
  employee: ProfileEmployee | null
  documents: ProfileDocument[]
}
