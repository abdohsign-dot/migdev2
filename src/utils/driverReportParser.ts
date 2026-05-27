/**
 * Driver Report Parser Utility
 * 
 * Parses driver auto-reports and automatically updates package statuses
 * in the admin database when reports are received.
 */

import { Package } from '../types';
import { updatePackage } from './localDatabase';

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface ParsedDriverReport {
  driverId?: string;
  driverName?: string;
  reportTimestamp?: string;
  connectionStatus: 'offline' | 'online';
  summary: {
    delivered: number;
    returned: number;
    inTransit: number;
    assigned: number;
  };
  completedTasks: CompletedTask[];
  financialSummary: {
    cashCollected: number;
    totalRevenue: number;
    paidPackages: number;
    codPackages: number;
  };
}

export interface CompletedTask {
  referenceNumber: string;
  status: 'Delivered' | 'Returned';
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerPhone2?: string;
  amount?: number;
  isPaid?: boolean;
  deliveredAt?: string;
  acceptedAt?: string;
  returnReason?: string;
}

export interface UpdateResult {
  success: boolean;
  updatedPackages: string[];
  errors: string[];
  message: string;
}

// ============================================
// PARSING FUNCTIONS
// ============================================

/**
 * Parse driver report from WhatsApp message text
 */
export const parseDriverReport = (messageText: string): ParsedDriverReport | null => {
  try {
    const lines = messageText.split('\n').map(line => line.trim()).filter(line => line);
    
    // Check if this is a driver report
    if (!isDriverReport(lines)) {
      return null;
    }

    const report: ParsedDriverReport = {
      connectionStatus: 'offline',
      summary: { delivered: 0, returned: 0, inTransit: 0, assigned: 0 },
      completedTasks: [],
      financialSummary: { cashCollected: 0, totalRevenue: 0, paidPackages: 0, codPackages: 0 }
    };

    let currentSection = 'header';
    let taskIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse header information
      if (line.includes('👤 *Livreur:*')) {
        report.driverName = line.split('*Livreur:*')[1]?.trim();
      } else if (line.includes('🆔 *ID Livreur:*')) {
        report.driverId = line.split('*ID Livreur:*')[1]?.trim();
      } else if (line.includes('📱 *Date du rapport:*')) {
        report.reportTimestamp = line.split('*Date du rapport:*')[1]?.trim();
      } else if (line.includes('🚨 *Statut:*')) {
        report.connectionStatus = line.includes('HORS LIGNE') ? 'offline' : 'online';
      }

      // Parse summary section
      else if (line.includes('📋 *RÉSUMÉ DES TÂCHES*')) {
        currentSection = 'summary';
      } else if (currentSection === 'summary' && line.includes('✅ *Livré:*')) {
        report.summary.delivered = extractNumber(line);
      } else if (currentSection === 'summary' && line.includes('⚠️ *Retourné:*')) {
        report.summary.returned = extractNumber(line);
      } else if (currentSection === 'summary' && line.includes('🚚 *En cours:*')) {
        report.summary.inTransit = extractNumber(line);
      } else if (currentSection === 'summary' && line.includes('📦 *Assigné:*')) {
        report.summary.assigned = extractNumber(line);
      }

      // Parse completed tasks section
      else if (line.includes('📋 *LISTE DES TÂCHES TERMINÉES*')) {
        currentSection = 'tasks';
      } else if (currentSection === 'tasks' && line.match(/^\d+\.\s*[✅⚠️]\s*\*/)) {
        const task = parseTaskLine(lines, i);
        if (task) {
          report.completedTasks.push(task);
          taskIndex++;
        }
      }

      // Parse financial summary
      else if (line.includes('📊 *RÉSUMÉ FINANCIER*')) {
        currentSection = 'financial';
      } else if (currentSection === 'financial' && line.includes('💰 *Cash collecté:*')) {
        report.financialSummary.cashCollected = extractAmount(line);
      } else if (currentSection === 'financial' && line.includes('💵 *Revenu total:*')) {
        report.financialSummary.totalRevenue = extractAmount(line);
      } else if (currentSection === 'financial' && line.includes('📦 *Colis payés:*')) {
        report.financialSummary.paidPackages = extractNumber(line);
      } else if (currentSection === 'financial' && line.includes('💳 *Colis COD:*')) {
        report.financialSummary.codPackages = extractNumber(line);
      }
    }

    return report;
  } catch (error) {
    console.error('Error parsing driver report:', error);
    return null;
  }
};

/**
 * Check if message is a driver report
 */
const isDriverReport = (lines: string[]): boolean => {
  const reportKeywords = [
    '📦 *RAPPORT DE LIVRAISON AUTOMATIQUE*',
    '🚨 *Statut:*',
    '📋 *RÉSUMÉ DES TÂCHES*',
    '📊 *RÉSUMÉ FINANCIER*'
  ];
  
  return reportKeywords.some(keyword => lines.some(line => line.includes(keyword)));
};

/**
 * Extract number from line
 */
const extractNumber = (line: string): number => {
  const match = line.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Extract amount from line
 */
const extractAmount = (line: string): number => {
  const match = line.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};

/**
 * Parse individual task from report lines
 */
const parseTaskLine = (lines: string[], startIndex: number): CompletedTask | null => {
  try {
    const taskLine = lines[startIndex];
    const task: CompletedTask = {
      referenceNumber: '',
      status: 'Delivered',
    };

    // Parse task header: "1. ✅ *PKG-123456* - LIVRÉ"
    const taskMatch = taskLine.match(/\d+\.\s*([✅⚠️])\s*\*([^*]+)\*\s*-\s*(.+)/);
    if (taskMatch) {
      task.referenceNumber = taskMatch[2].trim();
      task.status = taskMatch[3].includes('LIVRÉ') ? 'Delivered' : 'Returned';
    }

    // Parse following lines for task details
    for (let i = startIndex + 1; i < Math.min(startIndex + 8, lines.length); i++) {
      const detailLine = lines[i];
      
      // Stop if we hit the next task or a new section
      if (detailLine.match(/^\d+\.\s*[✅⚠️]/) || detailLine.includes('═')) {
        break;
      }

      if (detailLine.includes('👤 Client:')) {
        task.customerName = detailLine.split('👤 Client:')[1]?.trim();
      } else if (detailLine.includes('📍 Adresse:')) {
        task.customerAddress = detailLine.split('📍 Adresse:')[1]?.trim();
      } else if (detailLine.includes('📞 Téléphone:')) {
        task.customerPhone = detailLine.split('📞 Téléphone:')[1]?.trim();
      } else if (detailLine.includes('📞 Téléphone 2:')) {
        task.customerPhone2 = detailLine.split('📞 Téléphone 2:')[1]?.trim();
      } else if (detailLine.includes('💰 Montant:')) {
        const amountMatch = detailLine.match(/(\d+(?:\.\d+)?)\s*DH/);
        if (amountMatch) {
          task.amount = parseFloat(amountMatch[1]);
        }
        task.isPaid = detailLine.includes('Payé');
      } else if (detailLine.includes('📅 Livré le:')) {
        task.deliveredAt = detailLine.split('📅 Livré le:')[1]?.trim();
      } else if (detailLine.includes('✅ Accepté le:')) {
        task.acceptedAt = detailLine.split('✅ Accepté le:')[1]?.trim();
      } else if (detailLine.includes('🔙 Raison retour:')) {
        task.returnReason = detailLine.split('🔙 Raison retour:')[1]?.trim();
      }
    }

    return task.referenceNumber ? task : null;
  } catch (error) {
    console.error('Error parsing task line:', error);
    return null;
  }
};

// ============================================
// AUTO-UPDATE FUNCTIONS
// ============================================

/**
 * Automatically update packages based on driver report
 */
export const autoUpdatePackagesFromReport = async (
  report: ParsedDriverReport,
  existingPackages: Package[]
): Promise<UpdateResult> => {
  const result: UpdateResult = {
    success: true,
    updatedPackages: [],
    errors: [],
    message: ''
  };

  try {
    if (!report.completedTasks.length) {
      result.message = 'Aucune tâche terminée à mettre à jour';
      return result;
    }

    for (const task of report.completedTasks) {
      try {
        // Find matching package by reference number
        const packageToUpdate = existingPackages.find(
          pkg => pkg.ref_number.toLowerCase() === task.referenceNumber.toLowerCase()
        );

        if (!packageToUpdate) {
          result.errors.push(`Colis ${task.referenceNumber} non trouvé dans la base de données`);
          continue;
        }

        // Check if package status needs updating
        if (packageToUpdate.status === task.status) {
          result.errors.push(`Colis ${task.referenceNumber} déjà au statut ${task.status}`);
          continue;
        }

        // Prepare update data
        const updateData: Partial<Package> = {
          status: task.status,
          _last_modified: new Date().toISOString()
        };

        // Add delivery timestamp if delivered OR returned (your DB/UI uses delivered_at for both)
        if (task.status === 'Delivered' && task.deliveredAt) {
          updateData.delivered_at = parseFrenchDateTime(task.deliveredAt);
        } else if (task.status === 'Delivered') {
          updateData.delivered_at = new Date().toISOString();
        } else if (task.status === 'Returned') {
          // If driver report didn't include delivered date, still ensure delivered_at exists.
          // Supabase sync logic expects delivered_at for Returned too.
          updateData.delivered_at = new Date().toISOString();
        }

        // Add return reason if returned
        if (task.status === 'Returned' && task.returnReason) {
          updateData.return_reason = task.returnReason;
        }


        // Update customer info if provided
        if (task.customerName) updateData.customer_name = task.customerName;
        if (task.customerAddress) updateData.customer_address = task.customerAddress;
        if (task.customerPhone) updateData.customer_phone = task.customerPhone;
        if (task.customerPhone2) updateData.customer_phone_2 = task.customerPhone2;
        if (task.amount !== undefined) updateData.price = task.amount;
        if (task.isPaid !== undefined) updateData.is_paid = task.isPaid;

        // Update the package
        await updatePackage(packageToUpdate.id, updateData);
        result.updatedPackages.push(task.referenceNumber);

        console.log(`✅ Updated package ${task.referenceNumber} to ${task.status}`);
      } catch (error) {
        console.error(`Error updating package ${task.referenceNumber}:`, error);
        result.errors.push(`Échec mise à jour ${task.referenceNumber}: ${error}`);
      }
    }

    // Generate result message
    if (result.updatedPackages.length > 0) {
      result.message = `✅ ${result.updatedPackages.length} colis mis à jour automatiquement`;
      
      if (result.errors.length > 0) {
        result.message += ` | ⚠️ ${result.errors.length} erreurs`;
      }
    } else {
      result.success = false;
      result.message = '❌ Aucun colis mis à jour';
    }

    return result;
  } catch (error) {
    console.error('Auto-update error:', error);
    result.success = false;
    result.message = `❌ Erreur lors de la mise à jour automatique: ${error}`;
    return result;
  }
};

/**
 * Parse French date/time string to ISO format
 */
const parseFrenchDateTime = (frenchDateTime: string): string => {
  try {
    // Example: "09/05/2026 14:30"
    const match = frenchDateTime.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hours, minutes] = match;
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      );
      return date.toISOString();
    }
    return new Date().toISOString();
  } catch (error) {
    console.error('Error parsing French date time:', error);
    return new Date().toISOString();
  }
};

/**
 * Validate report integrity
 */
export const validateReport = (report: ParsedDriverReport): string[] => {
  const warnings: string[] = [];

  if (!report.driverId && !report.driverName) {
    warnings.push('Informations du livreur manquantes');
  }

  if (report.completedTasks.length === 0) {
    warnings.push('Aucune tâche terminée dans le rapport');
  }

  const totalCompleted = report.summary.delivered + report.summary.returned;
  if (totalCompleted !== report.completedTasks.length) {
    warnings.push('Incohérence entre le résumé et les tâches détaillées');
  }

  // Check for duplicate reference numbers
  const refNumbers = report.completedTasks.map(t => t.referenceNumber);
  const duplicates = refNumbers.filter((ref, index) => refNumbers.indexOf(ref) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Références en double: ${duplicates.join(', ')}`);
  }

  return warnings;
};
