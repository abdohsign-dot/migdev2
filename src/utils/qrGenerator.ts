/**
 * QR Code Generator Utility
 * Converts package data to QR-encodable format
 */

interface QRCodeData {
  ref_number: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_phone_2?: string;
  sender_name: string;
  sender_company?: string;
  sender_phone: string;
  date_of_arrive: string;
  supplement_info?: string;
  description: string;
  weight: string;
  gps_lat: number;
  gps_lng: number;
  limit_date: string;
  limit_time?: string; // HH:mm (optional)
  price: number;
  is_paid: boolean;
}

/**
 * Converts a package object to a JSON string suitable for QR encoding
 * @param packageData - The package data object
 * @returns JSON string to be encoded in QR code
 */
export const generateQRString = (packageData: Partial<QRCodeData>): string => {
  return JSON.stringify(packageData);
};

/**
 * Extracts QR-relevant fields from a full package object
 * @param fullPackage - The complete package object
 * @returns Object with only QR-needed fields
 */
export const extractQRData = (fullPackage: any): QRCodeData => {
  return {
    ref_number: fullPackage.ref_number,
    customer_name: fullPackage.customer_name,
    customer_address: fullPackage.customer_address,
    customer_phone: fullPackage.customer_phone,
    customer_phone_2: fullPackage.customer_phone_2,
    sender_name: fullPackage.sender_name,
    sender_company: fullPackage.sender_company,
    sender_phone: fullPackage.sender_phone,
    date_of_arrive: fullPackage.date_of_arrive,
    supplement_info: fullPackage.supplement_info,
    description: fullPackage.description,
    weight: fullPackage.weight,
    gps_lat: fullPackage.gps_lat,
    gps_lng: fullPackage.gps_lng,
    limit_date: fullPackage.limit_date,
    ...(fullPackage.limit_time ? { limit_time: fullPackage.limit_time } : {}),
    price: fullPackage.price,
    is_paid: fullPackage.is_paid,
  };
};
