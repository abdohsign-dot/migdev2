/**
 * Offline Export Utility
 * 
 * Allows drivers to export package status updates when Firebase is down.
 * Supports multiple formats: WhatsApp, Email, CSV, PDF-like text
 */

import { Alert, Platform } from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { Package } from '../types';
import { formatPhoneForWhatsApp } from './phoneUtils';


// ============================================
// FORMAT GENERATORS
// ============================================

/**
 * Generate driver-to-admin WhatsApp report (same format as admin-to-driver)
 */
export const generateDriverToAdminReport = (packages: Package[], driverName?: string, driverId?: string): string => {
  const timestamp = new Date().toLocaleString('fr-FR');
  
  // Count by status
  const delivered = packages.filter(p => p.status === 'Delivered');
  const returned = packages.filter(p => p.status === 'Returned');
  const inTransit = packages.filter(p => p.status === 'In Transit');
  const assigned = packages.filter(p => p.status === 'Assigned');
  
  // Only include completed tasks (delivered/returned) in the report
  const completedTasks = packages.filter(p => p.status === 'Delivered' || p.status === 'Returned');
  
  let message = `📦 *RAPPORT DE LIVRAISON AUTOMATIQUE* 🚚\n\n`;
  message += `👤 *Livreur:* ${driverName || 'N/A'}\n`;
  message += `🆔 *ID Livreur:* ${driverId || 'N/A'}\n`;
  message += `📱 *Date du rapport:* ${timestamp}\n`;
  message += `🚨 *Statut:* HORS LIGNE - Connexion Firebase perdue\n\n`;
  
  message += `📋 *RÉSUMÉ DES TÂCHES*\n`;
  message += `${'='.repeat(30)}\n\n`;
  message += `✅ *Livré:* ${delivered.length} colis\n`;
  message += `⚠️ *Retourné:* ${returned.length} colis\n`;
  message += `🚚 *En cours:* ${inTransit.length} colis\n`;
  message += `📦 *Assigné:* ${assigned.length} colis\n\n`;
  
  if (completedTasks.length > 0) {
    message += `📋 *LISTE DES TÂCHES TERMINÉES*\n`;
    message += `${'='.repeat(30)}\n\n`;

    completedTasks.forEach((pkg, index) => {
      const isDelivered = pkg.status === 'Delivered';
      const statusIcon = isDelivered ? '✅' : '⚠️';
      const statusText = isDelivered ? 'LIVRÉ' : 'RETOURNÉ';
      
      message += `${index + 1}. ${statusIcon} *${pkg.ref_number}* - ${statusText}\n`;
      message += `   👤 Client: ${pkg.customer_name || 'N/A'}\n`;
      message += `   📍 Adresse: ${pkg.customer_address || 'N/A'}\n`;
      message += `   📞 Téléphone: ${pkg.customer_phone || 'N/A'}\n`;
      if (pkg.customer_phone_2) {
        message += `   📞 Téléphone 2: ${pkg.customer_phone_2}\n`;
      }
      message += `   💰 Montant: ${pkg.is_paid ? 'Payé' : `${pkg.price || 0} DH`}\n`;
      
      if (isDelivered && pkg.delivered_at) {
        message += `   📅 Livré le: ${new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}\n`;
      }
      
      if (!isDelivered && pkg.return_reason) {
        message += `   🔙 Raison retour: ${pkg.return_reason}\n`;
      }
      
      if (pkg.accepted_at) {
        message += `   ✅ Accepté le: ${new Date(pkg.accepted_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}\n`;
      }
      
      message += `\n`;
    });

    // Financial summary
    const cashCollected = delivered.filter(p => !p.is_paid).reduce((sum, p) => sum + (p.price || 0), 0);
    const totalRevenue = completedTasks.reduce((sum, p) => sum + (p.price || 0), 0);
    
    message += `${'='.repeat(30)}\n`;
    message += `📊 *RÉSUMÉ FINANCIER*\n`;
    message += `💰 *Cash collecté:* ${cashCollected.toFixed(2)} DH\n`;
    message += `💵 *Revenu total:* ${totalRevenue.toFixed(2)} DH\n`;
    message += `📦 *Colis payés:* ${completedTasks.filter(p => p.is_paid).length}\n`;
    message += `💳 *Colis COD:* ${completedTasks.filter(p => !p.is_paid).length}\n\n`;
  } else {
    message += `ℹ️ *Aucune tâche terminée à signaler*\n\n`;
  }

  message += `${'='.repeat(30)}\n`;
  message += `⚠️ *INSTRUCTIONS POUR L'ADMIN*\n`;
  message += `• Veuillez mettre à jour manuellement les statuts dans Firebase\n`;
  message += `• Les tâches terminées ci-dessus doivent être synchronisées\n`;
  message += `• Le livreur est actuellement hors ligne\n\n`;
  message += `*Rapport généré automatiquement depuis Delivry App*\n`;
  message += `_Connexion perdue - ${timestamp}_`;

  return message;
};

/**
 * Send auto-report to admin via WhatsApp
 */
export const sendAutoReportToAdmin = async (packages: Package[], driverName?: string, driverId?: string, adminPhone?: string): Promise<void> => {
  try {
    const completedTasks = packages.filter(p => p.status === 'Delivered' || p.status === 'Returned');
    
    if (completedTasks.length === 0) {
      console.log('No completed tasks to report');
      return;
    }
    
    const message = generateDriverToAdminReport(packages, driverName, driverId);
    
    if (adminPhone) {
      // Send directly to admin WhatsApp
      const cleanPhone = formatPhoneForWhatsApp(adminPhone);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      const { Linking } = require('react-native');
      const supported = await Linking.canOpenURL(whatsappUrl);
      
      if (supported) {
        await Linking.openURL(whatsappUrl);
        console.log(`Auto-report sent to admin via WhatsApp: ${adminPhone}`);
      } else {
        console.log('WhatsApp not available, using general share');
        // Fallback to general share
        await Share.open({
          message: message,
          title: 'Rapport de livraison automatique',
        });
      }
    } else {
      // No admin phone, use general share
      await Share.open({
        message: message,
        title: 'Rapport de livraison automatique',
      });
    }
  } catch (error) {
    console.error('Auto-report error:', error);
    throw error;
  }
};

/**
 * Generate simple text format for WhatsApp/SMS - FOCUSED ON DELIVERY STATUS
 */
export const generateTextReport = (packages: Package[], driverName?: string): string => {
  const timestamp = new Date().toLocaleString('fr-FR');
  
  // Count by delivery status
  const delivered = packages.filter(p => p.status === 'Delivered');
  const notDelivered = packages.filter(p => p.status !== 'Delivered');
  const returned = packages.filter(p => p.status === 'Returned');
  
  const header = `📦 ÉTAT DES LIVRAISONS
Driver: ${driverName || 'N/A'}
Date: ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ LIVRÉS: ${delivered.length}
❌ NON LIVRÉS: ${notDelivered.length}
⚠️ RETOURNÉS: ${returned.length}

📋 LISTE DES COLIS:
`;

  // Sort by delivery status - Delivered first, then others
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return -1;
    if (a.status !== 'Delivered' && b.status === 'Delivered') return 1;
    return 0;
  });

  const packageLines = sortedPackages.map((pkg, index) => {
    const isDelivered = pkg.status === 'Delivered';
    const isReturned = pkg.status === 'Returned';
    const statusIcon = isDelivered ? '✅' : isReturned ? '⚠️' : '❌';
    
    return `${index + 1}. ${statusIcon} ${pkg.ref_number} - ${isDelivered ? 'LIVRÉ' : isReturned ? 'RETOURNÉ' : pkg.status}
   👤 ${pkg.customer_name || 'Client'} - ${pkg.customer_phone || 'N/A'}
   💰 ${pkg.price?.toFixed(2)} DH ${pkg.is_paid ? '(PAYÉ)' : '(COD)'}
   ${pkg.delivered_at ? `📅 Livré: ${new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}` : ''}
   ${pkg.return_reason ? `🔙 Raison: ${pkg.return_reason}` : ''}
`;
  }).join('\n');

  const summary = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
� RÉSUMÉ FINANCIER:
✓ Encaissé: ${delivered.filter(p => !p.is_paid).reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} DH
� Total colis: ${packages.length}
� Taux livraison: ${packages.length > 0 ? ((delivered.length / packages.length) * 100).toFixed(1) : 0}%
`;

  return header + packageLines + summary;
};

/**
 * Generate CSV format for spreadsheet import - FOCUSED ON DELIVERY STATUS
 */
export const generateCSV = (packages: Package[]): string => {
  const headers = [
    'STATUT_LIVRAISON',
    'Référence',
    'Client',
    'Téléphone',
    'Montant',
    'Payé',
    'Date_Livraison',
    'Accepté_Le',
    'Adresse',
    'Raison_Retour'
  ].join(',');

  // Sort by delivery status - Delivered first
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return -1;
    if (a.status !== 'Delivered' && b.status === 'Delivered') return 1;
    return 0;
  });

  const rows = sortedPackages.map(pkg => {
    const isDelivered = pkg.status === 'Delivered';
    const deliveryStatus = isDelivered ? 'LIVRÉ' : pkg.status === 'Returned' ? 'RETOURNÉ' : 'NON LIVRÉ';
    
    return [
      `"${deliveryStatus}"`,
      pkg.ref_number,
      `"${pkg.customer_name || ''}"`,
      pkg.customer_phone || '',
      pkg.price?.toFixed(2) || '0',
      pkg.is_paid ? 'OUI' : 'NON',
      pkg.delivered_at ? new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '',
      pkg.accepted_at ? new Date(pkg.accepted_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '',
      `"${pkg.customer_address || ''}"`,
      `"${pkg.return_reason || ''}"`
    ].join(',');
  }).join('\n');

  return headers + '\n' + rows;
};

/**
 * Generate detailed report (PDF-like text format) - FOCUSED ON DELIVERY STATUS
 */
export const generateDetailedReport = (packages: Package[], driverName?: string): string => {
  const timestamp = new Date().toLocaleString('fr-FR');
  
  // Count by delivery status
  const delivered = packages.filter(p => p.status === 'Delivered');
  const notDelivered = packages.filter(p => p.status !== 'Delivered');
  const returned = packages.filter(p => p.status === 'Returned');
  
  let report = `╔════════════════════════════════════════════════════════════╗
║              ÉTAT DES LIVRAISONS - RAPPORT DÉTAILLÉ           ║
╚════════════════════════════════════════════════════════════╝

Driver: ${driverName || 'N/A'}
Date du rapport: ${timestamp}
Total colis: ${packages.length}

╔════════════════════════════════════════════════════════════╗
║                       RÉSUMÉ LIVRAISON                     ║
╚════════════════════════════════════════════════════════════╝
✅ LIVRÉS:        ${delivered.length} colis
❌ NON LIVRÉS:     ${notDelivered.length} colis  
⚠️ RETOURNÉS:     ${returned.length} colis
📊 TAUX LIVRAISON: ${packages.length > 0 ? ((delivered.length / packages.length) * 100).toFixed(1) : 0}%
💵 CASH COLLECTÉ:  ${delivered.filter(p => !p.is_paid).reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} DH

`;

  // Sort by delivery status - Delivered first, then others
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return -1;
    if (a.status !== 'Delivered' && b.status === 'Delivered') return 1;
    return 0;
  });

  // Group by delivery status for better organization
  const byStatus = {
    'LIVRÉ': delivered,
    'RETOURNÉ': returned,
    'NON LIVRÉ': packages.filter(p => p.status !== 'Delivered' && p.status !== 'Returned'),
  };

  Object.entries(byStatus).forEach(([status, pkgs]) => {
    if (pkgs.length === 0) return;
    
    const statusIcon = status === 'LIVRÉ' ? '✅' : status === 'RETOURNÉ' ? '⚠️' : '❌';
    
    report += `\n${'═'.repeat(60)}\n`;
    report += `${statusIcon} ${status} (${pkgs.length} colis)\n`;
    report += `${'═'.repeat(60)}\n\n`;

    pkgs.forEach((pkg, index) => {
      report += `${index + 1}. ${pkg.ref_number}\n`;
      report += `   Client: ${pkg.customer_name || 'N/A'}\n`;
      report += `   Téléphone: ${pkg.customer_phone || 'N/A'}\n`;
      report += `   Montant: ${pkg.price?.toFixed(2)} DH ${pkg.is_paid ? '(PAYÉ)' : '(COD)'}\n`;
      
      if (pkg.customer_address) {
        report += `   Adresse: ${pkg.customer_address}\n`;
      }
      
      if (status === 'LIVRÉ' && pkg.delivered_at) {
        report += `   📅 DATE LIVRAISON: ${new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}\n`;
      }
      
      if (status === 'RETOURNÉ' && pkg.return_reason) {
        report += `   🔙 RAISON RETOUR: ${pkg.return_reason}\n`;
      }
      
      if (status === 'NON LIVRÉ') {
        report += `   📋 STATUT ACTUEL: ${pkg.status}\n`;
      }
      
      report += '\n';
    });
  });

  // Summary
  const totalCash = packages
    .filter(p => p.status === 'Delivered' && !p.is_paid)
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const acceptedPackages = packages.filter(p => p.status !== 'Pending' && p.status !== 'Assigned');

  report += `\n${'═'.repeat(60)}\n`;
  report += `RÉSUMÉ FINANCIER\n`;
  report += `${'═'.repeat(60)}\n`;
  report += `Cash collecté (COD): ${totalCash.toFixed(2)} DH\n`;
  report += `Colis payés: ${acceptedPackages.filter(p => p.is_paid).length}\n`;
  report += `Colis COD: ${acceptedPackages.filter(p => !p.is_paid).length}\n`;
  report += `\nRevenu total: ${acceptedPackages.reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} DH\n`;

  return report;
};

/**
 * Generate JSON format for technical backup
 */
export const generateJSON = (packages: Package[]): string => {
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    packageCount: packages.length,
    packages: packages.map(pkg => ({
      id: pkg.id,
      ref_number: pkg.ref_number,
      status: pkg.status,
      customer_name: pkg.customer_name,
      customer_address: pkg.customer_address,
      customer_phone: pkg.customer_phone,
      customer_phone_2: pkg.customer_phone_2,
      price: pkg.price,
      is_paid: pkg.is_paid,
      limit_date: pkg.limit_date,
      accepted_at: pkg.accepted_at,
      delivered_at: pkg.delivered_at,
      return_reason: pkg.return_reason,
      _last_modified: pkg._last_modified,
    }))
  };

  return JSON.stringify(exportData, null, 2);
};

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Encodes string to UTF-8 safe base64
 */
const toBase64 = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  const utf8 = unescape(encodeURIComponent(str));
  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i));
  }
  
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    const b2 = i < bytes.length ? bytes[i++] : NaN;
    const b3 = i < bytes.length ? bytes[i++] : NaN;
    
    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (Number.isNaN(b2) ? 0 : b2 >> 4);
    const enc3 = Number.isNaN(b2) ? 64 : ((b2 & 15) << 2) | (Number.isNaN(b3) ? 0 : b3 >> 6);
    const enc4 = Number.isNaN(b3) ? 64 : b3 & 63;
    
    result += chars.charAt(enc1) +
              chars.charAt(enc2) +
              (enc3 === 64 ? '=' : chars.charAt(enc3)) +
              (enc4 === 64 ? '=' : chars.charAt(enc4));
  }
  return result;
};

/**
 * Export via WhatsApp
 */
export const exportViaWhatsApp = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const message = generateTextReport(packages, driverName);
    
    // Try WhatsApp URL scheme first
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    await Share.open({
      message: message,
    });
  } catch (error) {
    console.error('WhatsApp export error:', error);
    
    // Fallback to general share
    try {
      await Share.open({
        message: generateTextReport(packages, driverName),
      });
    } catch (fallbackError) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp. Assurez-vous qu\'il est installé.');
    }
  }
};

/**
 * Export as CSV file
 */
export const exportAsCSV = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const csv = generateCSV(packages);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeDriverName = (driverName || 'driver').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    const filename = `livraisons_${safeDriverName}_${timestamp}.csv`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    // Write local backup file
    await RNFS.writeFile(path, csv, 'utf8');
    
    // Convert to base64
    const base64Data = toBase64(csv);
    
    // Share file via base64
    await Share.open({
      url: `data:text/csv;base64,${base64Data}`,
      filename: filename,
      type: 'text/csv',
      title: 'Exporter le rapport',
      subject: `Rapport de livraison - ${driverName || 'Driver'}`,
    });
  } catch (error) {
    console.error('CSV export error:', error);
    Alert.alert('Erreur', 'Impossible de créer le fichier CSV.');
  }
};

/**
 * Export as detailed text report
 */
export const exportAsTextReport = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const report = generateDetailedReport(packages, driverName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeDriverName = (driverName || 'driver').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    const filename = `rapport_${safeDriverName}_${timestamp}.txt`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    // Write local backup file
    await RNFS.writeFile(path, report, 'utf8');
    
    // Convert to base64
    const base64Data = toBase64(report);
    
    // Share file via base64
    await Share.open({
      url: `data:text/plain;base64,${base64Data}`,
      filename: filename,
      type: 'text/plain',
      title: 'Exporter le rapport détaillé',
      subject: `Rapport détaillé - ${driverName || 'Driver'}`,
    });
  } catch (error) {
    console.error('Text report export error:', error);
    Alert.alert('Erreur', 'Impossible de créer le rapport.');
  }
};

/**
 * Export as JSON backup
 */
export const exportAsJSON = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const json = generateJSON(packages);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeDriverName = (driverName || 'driver').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    const filename = `backup_${safeDriverName}_${timestamp}.json`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    // Write local backup file
    await RNFS.writeFile(path, json, 'utf8');
    
    // Convert to base64
    const base64Data = toBase64(json);
    
    // Share file via base64
    await Share.open({
      url: `data:application/json;base64,${base64Data}`,
      filename: filename,
      type: 'application/json',
      title: 'Exporter la sauvegarde',
      subject: `Sauvegarde - ${driverName || 'Driver'}`,
    });
  } catch (error) {
    console.error('JSON export error:', error);
    Alert.alert('Erreur', 'Impossible de créer la sauvegarde JSON.');
  }
};

/**
 * Export via Email
 */
export const exportViaEmail = async (packages: Package[], driverName?: string, adminEmail?: string): Promise<void> => {
  try {
    const report = generateDetailedReport(packages, driverName);
    const subject = `Rapport de livraison - ${driverName || 'Driver'} - ${new Date().toLocaleDateString('fr-FR')}`;
    
    await Share.open({
      message: report,
      subject: subject,
      email: adminEmail,
    });
  } catch (error) {
    console.error('Email export error:', error);
    Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email.');
  }
};

/**
 * Quick share (let user choose app)
 */
export const quickShare = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const message = generateTextReport(packages, driverName);
    
    await Share.open({
      message: message,
      title: 'Partager le rapport',
    });
  } catch (error) {
    if ((error as any).message !== 'User did not share') {
      console.error('Quick share error:', error);
      Alert.alert('Erreur', 'Impossible de partager le rapport.');
    }
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get emoji for status
 */
const getStatusEmoji = (status: string): string => {
  const emojiMap: Record<string, string> = {
    'Pending': '📋',
    'Assigned': '📦',
    'In Transit': '🚚',
    'Delivered': '✅',
    'Returned': '⚠️',
  };
  return emojiMap[status] || '📦';
};

/**
 * Show export options dialog
 */
export const showExportOptions = (packages: Package[], driverName?: string, adminEmail?: string): void => {
  Alert.alert(
    '📤 Exporter le rapport',
    'Choisissez le format d\'export:',
    [
      {
        text: '💬 WhatsApp',
        onPress: () => exportViaWhatsApp(packages, driverName),
      },
      {
        text: '📧 Email',
        onPress: () => exportViaEmail(packages, driverName, adminEmail),
      },
      {
        text: '📊 CSV (Excel)',
        onPress: () => exportAsCSV(packages, driverName),
      },
      {
        text: '📄 Rapport détaillé',
        onPress: () => exportAsTextReport(packages, driverName),
      },
      {
        text: '💾 Backup JSON',
        onPress: () => exportAsJSON(packages, driverName),
      },
      {
        text: '📱 Partager',
        onPress: () => quickShare(packages, driverName),
      },
      {
        text: 'Annuler',
        style: 'cancel',
      },
    ],
    { cancelable: true }
  );
};
