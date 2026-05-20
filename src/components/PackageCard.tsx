import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { getStatusColor } from '../utils/statusColors';
import { formatPhoneForWhatsApp } from '../utils/phoneUtils';
import {
  deviceType,
  orientation,
  SPACING,
  FONTS,
  RESPONSIVE_SHADOWS,
  BORDER_RADIUS,
  responsiveSize,
} from '../utils/responsive';
import { theme } from '../theme';

interface PackageCardProps {
  pkg: {
    id: string;
    ref_number: string;
    customer_name?: string; // Made optional
    customer_address?: string; // Made optional
    customer_phone?: string;
    customer_phone_2?: string;
    gps_lat?: number;
    gps_lng?: number;
    status: string;
    price: number;
    is_paid: boolean;
    limit_date?: string; // Made optional
    limit_time?: string; // HH:mm
    description?: string;
    return_reason?: string;
    assigned_to?: string;
  };
  drivers?: Array<{ id: string; name: string }>;
  onAssign?: (id: string) => void;
  onUnassign?: (id: string) => void;
  onAccept?: (id: string) => void;
  onDeliver?: (id: string) => void;
  onReturn?: (id: string) => void;
  assigning?: boolean;
}

export default function PackageCard(props: PackageCardProps) {
  const { pkg, drivers, onAssign, onUnassign, onAccept, onDeliver, onReturn, assigning } = props;
  const status = pkg.status || 'Pending';
  const statusColor = getStatusColor(status);
  
  // French translations for status labels
  const statusLabels: Record<string, string> = {
    'Pending': 'En attente',
    'Assigned': 'Assigné',
    'In Transit': 'En cours',
    'Delivered': 'Livré',
    'Returned': 'Retourné'
  };
  
  const frenchStatus = statusLabels[status] || status;
  const customerName = pkg.customer_name || 'Client inconnu';
  const customerAddress = pkg.customer_address || 'Adresse non disponible';
  const limitDate = pkg.limit_date || 'N/A';
  const limitTime = pkg.limit_time;
  const packagePrice = typeof pkg.price === 'number' ? pkg.price.toFixed(2) : 'N/A';
  const assignedDriverName = pkg.assigned_to ? (drivers?.find(d => d.id === pkg.assigned_to)?.name || pkg.assigned_to) : null;

  const handleCallPhone = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleWhatsApp = (phone?: string) => {
    if (phone) {
      const formattedPhone = formatPhoneForWhatsApp(phone);
      Linking.openURL(`whatsapp://send?phone=${formattedPhone}`);
    }
  };

  const handleOpenMap = () => {
    if (pkg.gps_lat != null && pkg.gps_lng != null) {
      // Use geo: URI scheme for better native app support on Android
      // Falls back to https if Google Maps app is not installed
      const geoUrl = `geo:${pkg.gps_lat},${pkg.gps_lng}?q=${pkg.gps_lat},${pkg.gps_lng}`;
      const httpsUrl = `https://www.google.com/maps/search/?api=1&query=${pkg.gps_lat},${pkg.gps_lng}`;
      
      // Try geo: first (opens native Maps app), fallback to https
      Linking.canOpenURL(geoUrl).then(supported => {
        if (supported) {
          Linking.openURL(geoUrl);
        } else {
          Linking.openURL(httpsUrl);
        }
      }).catch(() => {
        // If geo: fails, use https as fallback
        Linking.openURL(httpsUrl);
      });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.refText}>{pkg.ref_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{frenchStatus}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{customerName}</Text>
        <Text style={styles.address} numberOfLines={1}>{customerAddress}</Text>
        
        {/* Driver Assignment Section */}
        <View style={styles.assignmentSection}>
          {assignedDriverName ? (
            <View style={styles.assignedDriverContainer}>
              <Text style={styles.driverLabel}>🚚 Assigné à: {assignedDriverName}</Text>
              {onUnassign && (
                <TouchableOpacity 
                  style={styles.unassignBtn} 
                  onPress={() => onUnassign(pkg.id)}
                >
                  <Text style={styles.unassignBtnText}>Annuler assignation</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            onAssign && (
              <TouchableOpacity 
                style={[styles.assignBtn, assigning && styles.assignBtnDisabled]} 
                onPress={() => onAssign(pkg.id)}
                disabled={assigning}
              >
                {assigning ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.assignBtnText}>Assigner à un chauffeur</Text>}
              </TouchableOpacity>
            )
          )}
        </View>
        
        {/* Description */}
        {pkg.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>📝 Description:</Text>
            <Text style={styles.descriptionText}>{pkg.description}</Text>
          </View>
        )}
        
        <Text style={styles.date}>
          À livrer avant: {limitDate}{limitTime ? ` ${limitTime}` : ''}
        </Text>
        
        {/* Customer Phone */}
        {(pkg.customer_phone || pkg.customer_phone_2) && (
          <View style={styles.phoneSection}>
            {pkg.customer_phone && (
              <View style={styles.phoneRow}>
                <Text style={styles.phoneNumber}>{pkg.customer_phone}</Text>
                <View style={styles.phoneActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleCallPhone(pkg.customer_phone)}>
                    <Text style={styles.iconText}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleWhatsApp(pkg.customer_phone)}>
                    <Text style={styles.iconText}>💬</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {pkg.customer_phone_2 && (
              <View style={styles.phoneRow}>
                <Text style={styles.phoneNumber}>{pkg.customer_phone_2}</Text>
                <View style={styles.phoneActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleCallPhone(pkg.customer_phone_2)}>
                    <Text style={styles.iconText}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleWhatsApp(pkg.customer_phone_2)}>
                    <Text style={styles.iconText}>💬</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* GPS Location */}
        {pkg.gps_lat && pkg.gps_lng && (
          <TouchableOpacity style={styles.mapBtn} onPress={handleOpenMap}>
            <View style={styles.mapContent}>
              <Text style={styles.mapIcon}>📍</Text>
              <Text style={styles.mapText}>Ouvrir dans Google Maps</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {pkg.status === 'Returned' && pkg.return_reason && (
          <Text style={styles.reasonText}>Raison: {pkg.return_reason}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.priceLabel}>Montant:</Text>
          <Text style={styles.priceValue}>{packagePrice} DH</Text>
          {pkg.is_paid && (
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>✓ PAYÉ</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {pkg.status === 'Pending' && onAssign && (
            <TouchableOpacity 
              style={[styles.actionBtn, assigning && styles.actionBtnDisabled]} 
              onPress={() => onAssign(pkg.id)}
              disabled={assigning}
            >
              {assigning ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionBtnText}>Assigner</Text>}
            </TouchableOpacity>
          )}

          {status === 'Assigned' && onAccept && (
            <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(pkg.id)}>
              <Text style={styles.actionBtnText}>Accepter</Text>
            </TouchableOpacity>
          )}

          {status === 'In Transit' && (onReturn || onDeliver) && (
            <>
              {onReturn && (
                <TouchableOpacity style={styles.returnBtn} onPress={() => onReturn(pkg.id)}>
                  <Text style={styles.actionBtnText}>Retour</Text>
                </TouchableOpacity>
              )}
              {onDeliver && (
                <TouchableOpacity style={styles.deliverBtn} onPress={() => onDeliver(pkg.id)}>
                  <Text style={styles.actionBtnText}>Livré</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: BORDER_RADIUS.responsive.card,
    padding: responsiveSize(10, 12),
    marginBottom: responsiveSize(8, 10),
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...RESPONSIVE_SHADOWS.card,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet
        ? {
            marginHorizontal: SPACING.xs,
            marginBottom: SPACING.xs,
          }
        : {},
      android: {},
    }),
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: responsiveSize(8, 10),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        marginBottom: SPACING.xs,
      } : {},
      android: {},
    }),
  },
  refText: {
    fontSize: FONTS.compact.small,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  statusBadge: { 
    paddingHorizontal: responsiveSize(6, 8), 
    paddingVertical: responsiveSize(2, 3), 
    borderRadius: BORDER_RADIUS.md 
  },
  statusText: {
    color: theme.colors.background,
    fontSize: FONTS.compact.tiny,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  body: { 
    marginBottom: responsiveSize(10, 12) 
  },
  name: {
    fontSize: FONTS.compact.subtitle,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: SPACING.xs,
  },
  address: {
    fontSize: FONTS.compact.caption,
    color: '#4B5563',
    marginBottom: SPACING.xs,
  },
  descriptionContainer: {
    backgroundColor: '#FEF3C7',
    padding: responsiveSize(6, 8),
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.warning,
  },
  descriptionLabel: {
    fontSize: FONTS.compact.tiny,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  descriptionText: {
    fontSize: FONTS.compact.caption,
    color: '#78350F',
    fontWeight: '500',
    lineHeight: 14,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, backgroundColor: '#EFF6FF', padding: responsiveSize(4, 6), borderRadius: BORDER_RADIUS.sm },
  driverLabel: { fontSize: FONTS.compact.tiny, color: '#1E40AF', fontWeight: '600', marginRight: SPACING.xs },
  driverName: { fontSize: FONTS.compact.tiny, color: '#1D4ED8', fontWeight: '700' },
  date: { fontSize: FONTS.compact.tiny, color: '#9CA3AF', fontStyle: 'italic' },
  reasonText: { fontSize: FONTS.compact.tiny, color: '#EF4444', fontStyle: 'italic', marginTop: 2, fontWeight: '600' },
  phoneSection: { marginTop: SPACING.sm },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceMuted,
    paddingVertical: responsiveSize(4, 6),
    paddingHorizontal: responsiveSize(8, 10),
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  phoneNumber: {
    fontSize: FONTS.compact.body,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  phoneActions: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  iconBtn: {
    backgroundColor: theme.colors.background,
    width: responsiveSize(28, 32),
    height: responsiveSize(28, 32),
    borderRadius: responsiveSize(14, 16),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginLeft: SPACING.xs,
  },
  iconText: { 
    fontSize: FONTS.compact.small,
  },
  phoneContainer: { flexDirection: 'row', gap: 8, marginTop: 8 },
  phoneBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  phoneText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  mapBtn: {
    backgroundColor: theme.colors.mapBg,
    paddingVertical: responsiveSize(8, 10),
    paddingHorizontal: responsiveSize(10, 12),
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
    shadowColor: theme.colors.mapBg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mapContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapIcon: {
    fontSize: FONTS.compact.body,
  },
  mapText: {
    color: theme.colors.background,
    fontSize: FONTS.compact.caption,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: responsiveSize(8, 10),
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: FONTS.compact.caption,
    color: theme.colors.textMuted,
    marginRight: SPACING.xs,
  },
  priceValue: {
    fontSize: FONTS.compact.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
    marginRight: SPACING.xs,
  },
  paidBadge: {
    backgroundColor: theme.colors.paidBg,
    paddingHorizontal: responsiveSize(6, 8),
    paddingVertical: responsiveSize(2, 3),
    borderRadius: BORDER_RADIUS.sm,
  },
  paidText: {
    color: theme.colors.paidText,
    fontSize: FONTS.compact.tiny,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '55%',
  },
  actionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: responsiveSize(8, 10),
    paddingVertical: responsiveSize(6, 8),
    borderRadius: BORDER_RADIUS.sm,
  },
  actionBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 },
  acceptBtn: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: responsiveSize(8, 10),
    paddingVertical: responsiveSize(6, 8),
    borderRadius: BORDER_RADIUS.sm,
  },
  deliverBtn: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: responsiveSize(8, 10),
    paddingVertical: responsiveSize(6, 8),
    borderRadius: BORDER_RADIUS.sm,
  },
  returnBtn: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: responsiveSize(8, 10),
    paddingVertical: responsiveSize(6, 8),
    borderRadius: BORDER_RADIUS.sm,
  },
  actionBtnText: { color: theme.colors.background, fontSize: FONTS.compact.tiny, fontWeight: '700' },
  
  // Assignment section styles
  assignmentSection: { marginTop: SPACING.sm },
  assignedDriverContainer: { 
    backgroundColor: '#EFF6FF', 
    padding: responsiveSize(8, 10), 
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  assignBtn: { 
    backgroundColor: '#3B82F6', 
    paddingHorizontal: responsiveSize(12, 16), 
    paddingVertical: responsiveSize(8, 10), 
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  assignBtnDisabled: { backgroundColor: '#9CA3AF' },
  assignBtnText: { color: '#FFFFFF', fontSize: FONTS.compact.caption, fontWeight: '700' },
  unassignBtn: { 
    backgroundColor: '#EF4444', 
    paddingHorizontal: responsiveSize(8, 10), 
    paddingVertical: responsiveSize(4, 6), 
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
    alignSelf: 'flex-start',
  },
  unassignBtnText: { color: '#FFFFFF', fontSize: FONTS.compact.tiny, fontWeight: '600' },
});
