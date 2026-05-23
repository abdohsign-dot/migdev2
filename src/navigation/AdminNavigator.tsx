import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../types/navigation';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminPackageListScreen from '../screens/admin/AdminPackageListScreen';
import DriverListScreen from '../screens/admin/DriverListScreen';
import AddDriverScreen from '../screens/admin/AddDriverScreen';
import ModifyDriverScreen from '../screens/admin/ModifyDriverScreen';
import AddPackageScreen from '../screens/admin/AddPackageScreen';
import PackageListScreen from '../screens/admin/PackageListScreen';
import DriverCredentialsScreen from '../screens/admin/DriverCredentialsScreen';
import ChangeAdminPinScreen from '../screens/admin/ChangeAdminPinScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminNavigator() {
  return (
    <Stack.Navigator id="AdminStack" initialRouteName="AdminDashboard" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminPackageList" component={AdminPackageListScreen} />
      <Stack.Screen name="DriverList" component={DriverListScreen} />
      <Stack.Screen name="AddDriver" component={AddDriverScreen} />
      <Stack.Screen name="ModifyDriver" component={ModifyDriverScreen} />
      <Stack.Screen name="AddPackage" component={AddPackageScreen} />
      <Stack.Screen name="PackageList" component={PackageListScreen} />
      <Stack.Screen name="DriverCredentials" component={DriverCredentialsScreen} />
      <Stack.Screen name="ChangeAdminPin" component={ChangeAdminPinScreen} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
    </Stack.Navigator>
  );
}
