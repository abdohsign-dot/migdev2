import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../types/navigation';

import DelivererTaskScreen from '../screens/driver/DelivererTaskScreen';

const Stack = createNativeStackNavigator<DriverStackParamList>();

export default function DriverNavigator() {
  return (
    <Stack.Navigator id="DriverStack" initialRouteName="DelivererTask" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DelivererTask" component={DelivererTaskScreen} />
    </Stack.Navigator>
  );
}
