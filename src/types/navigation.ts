import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  DriverList: { mode?: 'assign'; packageId?: string; onAssign?: (driverId: string) => void } | undefined;
  AddDriver: undefined;
  ModifyDriver: { driver: any };
  AddPackage: { scannedData?: any } | undefined;
  DriverCredentials: undefined;
  AdminPackageList: { archivedOnly?: boolean } | undefined;
  PackageList: undefined;
  ChangeAdminPin: undefined;
  AdminReports: undefined;
};

export type DriverStackParamList = {
  DelivererTask: undefined;
  PackageList: undefined;
};

// Auth Screen Props
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Admin Screen Props
export type AdminDashboardScreenProps = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;
export type AdminPackageListScreenProps = NativeStackScreenProps<AdminStackParamList, 'AdminPackageList'>;
export type DriverListScreenProps = NativeStackScreenProps<AdminStackParamList, 'DriverList'>;
export type AddDriverScreenProps = NativeStackScreenProps<AdminStackParamList, 'AddDriver'>;
export type ModifyDriverScreenProps = NativeStackScreenProps<AdminStackParamList, 'ModifyDriver'>;
export type AddPackageScreenProps = NativeStackScreenProps<AdminStackParamList, 'AddPackage'>;
export type DriverCredentialsScreenProps = NativeStackScreenProps<AdminStackParamList, 'DriverCredentials'>;
export type ChangeAdminPinScreenProps = NativeStackScreenProps<AdminStackParamList, 'ChangeAdminPin'>;
export type AdminReportsScreenProps = NativeStackScreenProps<AdminStackParamList, 'AdminReports'>;

// Driver Screen Props
export type DelivererTaskScreenProps = NativeStackScreenProps<DriverStackParamList, 'DelivererTask'>;
export type PackageListScreenProps = NativeStackScreenProps<DriverStackParamList, 'PackageList'>;
