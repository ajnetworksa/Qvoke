/**
 * Utility functions for generating Saudi ZATCA Phase 1 (E-Invoicing) required data.
 */

/**
 * Generates the TLV (Tag-Length-Value) encoded byte array for a single field.
 */
function getTlvBytes(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

/**
 * Generates the ZATCA Phase 1 Base64 encoded TLV string for the QR code.
 * @param sellerName Company/Seller Name
 * @param vatRegistrationNumber 15-digit VAT number
 * @param timestamp Invoice Date and Time (ISO 8601 format)
 * @param invoiceTotal Invoice Total with VAT
 * @param vatTotal Total VAT amount
 * @returns Base64 encoded string representing the TLV QR code data
 */
export function generateZatcaQRBase64(
  sellerName: string,
  vatRegistrationNumber: string,
  timestamp: string | Date,
  invoiceTotal: number,
  vatTotal: number
): string {
  const tlv1 = getTlvBytes(1, sellerName);
  const tlv2 = getTlvBytes(2, vatRegistrationNumber);
  
  // ZATCA expects timestamp in ISO 8601 format or similar (e.g. 2022-04-25T15:30:00Z)
  const timeStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
  const tlv3 = getTlvBytes(3, timeStr);
  
  // ZATCA expects amounts as strings, usually 2 decimal places
  const tlv4 = getTlvBytes(4, invoiceTotal.toFixed(2));
  const tlv5 = getTlvBytes(5, vatTotal.toFixed(2));

  const totalLength = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
  const qrBytes = new Uint8Array(totalLength);
  
  let offset = 0;
  qrBytes.set(tlv1, offset); offset += tlv1.length;
  qrBytes.set(tlv2, offset); offset += tlv2.length;
  qrBytes.set(tlv3, offset); offset += tlv3.length;
  qrBytes.set(tlv4, offset); offset += tlv4.length;
  qrBytes.set(tlv5, offset);

  // Convert Uint8Array to base64
  // Using btoa with string from char codes is safe here because qrBytes is essentially 8-bit binary data
  let binary = '';
  for (let i = 0; i < qrBytes.byteLength; i++) {
    binary += String.fromCharCode(qrBytes[i]);
  }
  return btoa(binary);
}
