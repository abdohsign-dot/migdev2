import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Screen parameters
export type RootStackParamList = {
  Login: undefined;
  AdminDashboard: undefined;
  DriverList: { mode?: 'assign'; packageId?: string; onAssign?: (driverId: string) => void } | undefined;
  AddDriver: undefined;
  ModifyDriver: { driver: any };
  DelivererTask: undefined;
  AddPackage: { scannedData?: any } | undefined;
  DriverCredentials: undefined;
  PackageList: undefined;
  AdminPackageList: { archivedOnly?: boolean } | undefined;
  ChangeAdminPin: undefined;
};

// Screen props types using React Navigation's NativeStackScreenProps
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type AdminDashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;
export type AdminPackageListScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminPackageList'>;
export type DriverListScreenProps = NativeStackScreenProps<RootStackParamList, 'DriverList'>;
export type AddDriverScreenProps = NativeStackScreenProps<RootStackParamList, 'AddDriver'>;
export type ModifyDriverScreenProps = NativeStackScreenProps<RootStackParamList, 'ModifyDriver'>;
export type DelivererTaskScreenProps = NativeStackScreenProps<RootStackParamList, 'DelivererTask'>;
export type AddPackageScreenProps = NativeStackScreenProps<RootStackParamList, 'AddPackage'>;
export type DriverCredentialsScreenProps = NativeStackScreenProps<RootStackParamList, 'DriverCredentials'>;
export type ChangeAdminPinScreenProps = NativeStackScreenProps<RootStackParamList, 'ChangeAdminPin'>;
