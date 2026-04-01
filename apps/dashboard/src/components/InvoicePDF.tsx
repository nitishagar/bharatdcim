import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1e3a5f', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#555' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#1e3a5f', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 3 },
  grid: { flexDirection: 'row', gap: 8 },
  gridCell: { flex: 1, backgroundColor: '#f8f8f8', padding: 8, borderRadius: 4 },
  label: { fontSize: 8, color: '#888', marginBottom: 2 },
  value: { fontSize: 10, fontWeight: 'bold' },
  table: { width: '100%' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 5 },
  tableRowBold: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 6, backgroundColor: '#f0f4f8' },
  tableLabel: { flex: 3, color: '#555' },
  tableValue: { flex: 1, textAlign: 'right' },
  irnSection: { marginBottom: 16, padding: 8, backgroundColor: '#f0f7f0', borderRadius: 4 },
  irnPending: { marginBottom: 16, fontSize: 9, color: '#888', fontStyle: 'italic' },
  mono: { fontSize: 7, fontFamily: 'Courier', marginBottom: 4, color: '#333' },
  qrCode: { width: 80, height: 80, marginTop: 6 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#aaa' },
});

function formatPaisaPDF(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface InvoicePDFProps {
  invoiceNumber: string;
  invoiceDate: string;
  supplierGstin: string;
  recipientGstin: string;
  taxType: string;
  taxableAmountPaisa: number;
  cgstPaisa?: number | null;
  sgstPaisa?: number | null;
  igstPaisa?: number | null;
  totalTaxPaisa: number;
  totalAmountPaisa: number;
  status: string;
  financialYear: string;
  eInvoiceStatus?: string | null;
  irn?: string | null;
  ackNo?: string | null;
  ackDt?: string | null;
  qrCodeDataUrl?: string | null;
}

export function InvoicePDF(props: InvoicePDFProps) {
  const {
    invoiceNumber, invoiceDate, supplierGstin, recipientGstin,
    taxType, taxableAmountPaisa, cgstPaisa, sgstPaisa, igstPaisa,
    totalTaxPaisa, totalAmountPaisa, financialYear,
    eInvoiceStatus, irn, ackNo, ackDt, qrCodeDataUrl,
  } = props;

  const taxRows = taxType === 'CGST_SGST'
    ? [
        { label: 'CGST (9%)', value: cgstPaisa ?? 0 },
        { label: 'SGST (9%)', value: sgstPaisa ?? 0 },
      ]
    : [{ label: 'IGST (18%)', value: igstPaisa ?? 0 }];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Tax Invoice</Text>
          <Text style={styles.subtitle}>{invoiceNumber} &bull; FY {financialYear}</Text>
        </View>

        {eInvoiceStatus === 'irn_generated' && irn && (
          <View style={styles.irnSection}>
            <Text style={styles.label}>IRN:</Text>
            <Text style={styles.mono}>{irn}</Text>
            {ackNo && ackDt && (
              <Text style={styles.label}>Ack No: {ackNo}  |  Ack Date: {ackDt}</Text>
            )}
            {qrCodeDataUrl && (
              <Image src={qrCodeDataUrl} style={styles.qrCode} />
            )}
          </View>
        )}

        {eInvoiceStatus === 'pending_irn' && (
          <Text style={styles.irnPending}>IRN: Pending registration</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Invoice Date</Text>
              <Text style={styles.value}>{invoiceDate}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Supplier GSTIN</Text>
              <Text style={styles.value}>{supplierGstin}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Recipient GSTIN</Text>
              <Text style={styles.value}>{recipientGstin}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount Breakdown</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Taxable Amount</Text>
              <Text style={styles.tableValue}>{formatPaisaPDF(taxableAmountPaisa)}</Text>
            </View>
            {taxRows.map((row, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableLabel}>{row.label}</Text>
                <Text style={styles.tableValue}>{formatPaisaPDF(row.value)}</Text>
              </View>
            ))}
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Total Tax</Text>
              <Text style={styles.tableValue}>{formatPaisaPDF(totalTaxPaisa)}</Text>
            </View>
            <View style={styles.tableRowBold}>
              <Text style={[styles.tableLabel, { fontWeight: 'bold' }]}>Total Amount</Text>
              <Text style={[styles.tableValue, { fontWeight: 'bold' }]}>{formatPaisaPDF(totalAmountPaisa)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Generated by BharatDCIM &bull; This is a computer-generated tax invoice as per CGST Act.
        </Text>
      </Page>
    </Document>
  );
}
